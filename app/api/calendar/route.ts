import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { type NextRequest } from 'next/server';

// ③ 社内用内見カレンダー。内見予約と社内案内予約をまとめて返す。
//    社内ログイン必須のため、仲介会社からは参照できない。

/** カレンダー上の色分け区分。 */
export type CalendarCategory =
  | '仲介会社内見' // 🔵 承認済の内見予約
  | '社内案内'     // 🟢 社内案内予約
  | '仮予約'       // 🟠 承認待ちの内見予約
  | 'キャンセル';  // 🔴 却下された内見予約

export interface CalendarEntry {
  id: string;
  kind: '内見予約' | '社内案内予約';
  category: CalendarCategory;
  propertyId: string;
  propertyName: string;
  date: string;
  startTime: string;
  endTime: string;
  /** 内見予約は仲介会社名、社内案内予約は「社内案内」 */
  companyName: string;
  /** 内見予約は仲介担当者、社内案内予約は社内スタッフ名 */
  personName: string;
  /** 会社代表電話番号（社内案内予約では空） */
  phone: string;
  /** 担当者携帯番号（社内案内予約では空） */
  mobilePhone: string;
  /** 申込者のメールアドレス（社内案内予約では空） */
  email: string;
  /** 名刺のファイル名（未アップロードなら空） */
  cardFileName: string;
  cardMimeType: string;
  hasCard: boolean;
  notes: string;
  status: string;
  createdAt: string;
}

/** 内見予約のステータスを色分け区分へ変換する。 */
function toCategory(status: string): CalendarCategory {
  if (status === '承認済') return '仲介会社内見';
  if (status === '却下') return 'キャンセル';
  return '仮予約';
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  // ?from=YYYY-MM-DD&to=YYYY-MM-DD で対象期間を絞り込む（未指定なら全件）
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get('from') ?? '').trim();
  const to = (searchParams.get('to') ?? '').trim();
  const range =
    from && to ? { gte: from, lte: to } : from ? { gte: from } : to ? { lte: to } : undefined;

  const [reservations, internalBookings] = await Promise.all([
    // 却下（キャンセル）もカレンダー上では色分けして表示する。
    // ただし枠は占有しないため、重複判定の対象からは除外している（utils/schedule.ts）。
    prisma.reservation.findMany({
      where: range ? { preferredDate: range } : {},
      orderBy: [{ preferredDate: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.internalBooking.findMany({
      where: range ? { date: range } : {},
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    }),
  ]);

  const entries: CalendarEntry[] = [
    ...reservations.map((r) => ({
      id: r.id,
      kind: '内見予約' as const,
      category: toCategory(r.status),
      propertyId: r.propertyId,
      propertyName: r.propertyName,
      date: r.preferredDate,
      startTime: r.startTime,
      endTime: r.endTime,
      companyName: r.companyName,
      personName: r.agentName,
      phone: r.phone,
      mobilePhone: r.mobilePhone,
      email: r.email,
      cardFileName: r.cardFileName,
      cardMimeType: r.cardMimeType,
      // 名刺の実データは返さない（/api/reservations/[id]/card から取得する）
      hasCard: r.cardData !== '',
      notes: r.notes,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    ...internalBookings.map((b) => ({
      id: b.id,
      kind: '社内案内予約' as const,
      category: '社内案内' as const,
      propertyId: b.propertyId,
      propertyName: b.propertyName,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      companyName: '社内案内',
      personName: b.staffName,
      phone: '',
      mobilePhone: '',
      email: '',
      cardFileName: '',
      cardMimeType: '',
      hasCard: false,
      notes: b.notes,
      status: '確定',
      createdAt: b.createdAt.toISOString(),
    })),
  ];

  entries.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)
  );

  return Response.json(entries);
}
