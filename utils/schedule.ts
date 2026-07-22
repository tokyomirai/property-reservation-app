// utils/schedule.ts
// 予約枠（開始時間・終了時間）の検証と、内見予約／社内案内予約を横断した重複チェック。
import { prisma } from './db';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "HH:MM" を 0時からの分数に変換する。不正な形式なら null。 */
export function toMinutes(time: string): number | null {
  const m = TIME_RE.exec((time ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 日付・開始・終了時間の妥当性を検証する。問題があればエラーメッセージを返す。 */
export function validateSlot(date: string, startTime: string, endTime: string): string | null {
  if (!DATE_RE.test((date ?? '').trim())) {
    return '日付の形式が正しくありません。';
  }
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null) return '開始時間を正しく入力してください。';
  if (end === null) return '終了時間を正しく入力してください。';
  if (end <= start) return '終了時間は開始時間より後の時刻を指定してください。';
  return null;
}

/** 予約一覧の表示・メール用の時間ラベルを組み立てる。 */
export function formatTimeRange(startTime: string, endTime: string): string {
  const s = (startTime ?? '').trim();
  const e = (endTime ?? '').trim();
  if (!s && !e) return '';
  if (!e) return s;
  return `${s}〜${e}`;
}

/** 2つの時間帯が重なっているか。終了時刻＝次の開始時刻は重複としない。 */
function overlaps(aStart: number, aEnd: number, bStart: string, bEnd: string): boolean {
  const s = toMinutes(bStart);
  const e = toMinutes(bEnd);
  // 開始・終了が未設定の旧データは枠が特定できないため重複判定の対象外とする
  if (s === null || e === null) return false;
  return aStart < e && s < aEnd;
}

export interface Conflict {
  kind: '内見予約' | '社内案内予約';
  label: string;
  startTime: string;
  endTime: string;
}

interface ConflictOptions {
  /** 判定から除外する内見予約ID（自分自身の更新時に使用） */
  excludeReservationId?: string;
  /** 判定から除外する社内案内予約ID */
  excludeInternalBookingId?: string;
  /** 未承認の内見予約も重複として扱うか（社内カレンダー登録時は true） */
  includePendingReservations?: boolean;
}

/**
 * 同一物件・同一日で時間帯が重なる予約を探す。
 * 内見予約（却下を除く）と社内案内予約の両方を対象とする。
 */
export async function findConflicts(
  propertyId: string,
  date: string,
  startTime: string,
  endTime: string,
  options: ConflictOptions = {}
): Promise<Conflict[]> {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null) return [];

  const statuses = options.includePendingReservations
    ? ['承認済', '未承認']
    : ['承認済'];

  const [reservations, internalBookings] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        propertyId,
        preferredDate: date,
        status: { in: statuses },
        ...(options.excludeReservationId ? { id: { not: options.excludeReservationId } } : {}),
      },
      select: { id: true, companyName: true, agentName: true, startTime: true, endTime: true, status: true },
    }),
    prisma.internalBooking.findMany({
      where: {
        propertyId,
        date,
        ...(options.excludeInternalBookingId ? { id: { not: options.excludeInternalBookingId } } : {}),
      },
      select: { id: true, staffName: true, startTime: true, endTime: true },
    }),
  ]);

  const conflicts: Conflict[] = [];

  for (const r of reservations) {
    if (overlaps(start, end, r.startTime, r.endTime)) {
      conflicts.push({
        kind: '内見予約',
        label: `${r.companyName} / ${r.agentName} 様（${r.status}）`,
        startTime: r.startTime,
        endTime: r.endTime,
      });
    }
  }

  for (const b of internalBookings) {
    if (overlaps(start, end, b.startTime, b.endTime)) {
      conflicts.push({
        kind: '社内案内予約',
        label: `社内案内：${b.staffName}`,
        startTime: b.startTime,
        endTime: b.endTime,
      });
    }
  }

  return conflicts;
}

/** 重複内容を利用者向けのエラーメッセージに整形する。 */
export function conflictMessage(date: string, conflicts: Conflict[]): string {
  const lines = conflicts.map(
    (c) => `・${formatTimeRange(c.startTime, c.endTime)}　${c.kind}（${c.label}）`
  );
  return [
    `${date} のご希望の時間帯は、既に他の予約が入っているため登録できません。`,
    '',
    '【重複している予約】',
    ...lines,
    '',
    'お手数ですが、別の時間帯をご指定ください。',
  ].join('\n');
}
