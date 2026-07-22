import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { type NextRequest } from 'next/server';

// ③ 社内用内見カレンダー。内見予約と社内案内予約をまとめて返す。
//    社内ログイン必須のため、仲介会社からは参照できない。

export interface CalendarEntry {
  id: string;
  kind: '内見予約' | '社内案内予約';
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
  notes: string;
  status: string;
  createdAt: string;
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
    prisma.reservation.findMany({
      // 却下された予約は枠を占有しないためカレンダーには載せない
      where: { status: { in: ['承認済', '未承認'] }, ...(range ? { preferredDate: range } : {}) },
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
      propertyId: r.propertyId,
      propertyName: r.propertyName,
      date: r.preferredDate,
      startTime: r.startTime,
      endTime: r.endTime,
      companyName: r.companyName,
      personName: r.agentName,
      phone: r.phone,
      mobilePhone: r.mobilePhone,
      notes: r.notes,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    ...internalBookings.map((b) => ({
      id: b.id,
      kind: '社内案内予約' as const,
      propertyId: b.propertyId,
      propertyName: b.propertyName,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      companyName: '社内案内',
      personName: b.staffName,
      phone: '',
      mobilePhone: '',
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
