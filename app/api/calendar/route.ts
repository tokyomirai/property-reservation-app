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
  /** 手動予約の種別（内見予約フォーム由来は undefined、手動登録は 自社案内/仲介案内） */
  bookingType?: '自社案内' | '仲介案内';
  /** アプリ外の手動登録か（カレンダーで「手動」ラベル表示に使用） */
  manual?: boolean;
  /** 手動予約の登録者（Google表示名・メール。内見予約フォーム由来は空） */
  createdByName?: string;
  createdByEmail?: string;
}

/** 内見予約のステータスを色分け区分へ変換する。 */
function toCategory(status: string): CalendarCategory {
  // 承認済・日時変更（時間だけ変更した確定予約）は「仲介会社内見」として青で表示
  if (status === '承認済' || status === '日時変更') return '仲介会社内見';
  // キャンセル（仲介都合）・却下（弊社都合）はどちらも赤の「キャンセル」区分で表示（詳細は個別ステータスで判別）
  if (status === '却下' || status === 'キャンセル') return 'キャンセル';
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
    ...internalBookings.map((b) => {
      const isBroker = b.bookingType === '仲介案内';
      // キャンセルは赤。それ以外は、自社案内=緑「社内案内」、仲介案内=青「仲介会社内見」。
      const category: CalendarCategory =
        b.status === 'キャンセル' ? 'キャンセル' : isBroker ? '仲介会社内見' : '社内案内';
      return {
        id: b.id,
        kind: '社内案内予約' as const,
        category,
        propertyId: b.propertyId,
        propertyName: b.propertyName,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        // 自社案内は会社名欄に「自社案内」、仲介案内は仲介会社名
        companyName: isBroker ? b.companyName : '自社案内',
        personName: isBroker ? b.agentName : b.staffName,
        phone: isBroker ? b.phone : '',
        mobilePhone: isBroker ? b.mobilePhone : '',
        email: isBroker ? b.email : '',
        cardFileName: '',
        cardMimeType: '',
        hasCard: false,
        notes: b.notes,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        bookingType: (isBroker ? '仲介案内' : '自社案内') as '自社案内' | '仲介案内',
        // 手動登録テーブル由来はすべて手動。仲介案内のときに「手動/アプリ外」ラベルを出す。
        manual: isBroker,
        createdByName: b.createdBy,
        createdByEmail: b.createdByEmail,
      };
    }),
  ];

  entries.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)
  );

  return Response.json(entries);
}
