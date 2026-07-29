import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { createCalendarEvent } from '../../../utils/lineworks';
import { validateSlot, findConflicts, conflictMessage } from '../../../utils/schedule';
import { type NextRequest } from 'next/server';

// ⑤ 社内案内予約。仲介会社には一切公開せず、社内ログイン時のみ操作できる。

const MAX_LEN: Record<string, number> = {
  staffName: 50,
  date: 20,
  startTime: 5,
  endTime: 5,
  notes: 1000,
};

const toStr = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// GET: 社内案内予約一覧（社内のみ）
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const bookings = await prisma.internalBooking.findMany({
    orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
  });
  return Response.json(bookings);
}

// POST: 社内案内予約の登録（社内のみ）
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();

  const fields = {
    staffName: toStr(body.staffName),
    date: toStr(body.date),
    startTime: toStr(body.startTime),
    endTime: toStr(body.endTime),
    notes: toStr(body.notes),
  };

  if (!body.propertyId || !fields.staffName) {
    return Response.json({ error: '物件と担当者は必須項目です。' }, { status: 400 });
  }

  for (const [key, max] of Object.entries(MAX_LEN)) {
    if (fields[key as keyof typeof fields].length > max) {
      return Response.json(
        { error: `入力内容が長すぎます（${key} は${max}文字以内で入力してください）。` },
        { status: 400 }
      );
    }
  }

  const slotError = validateSlot(fields.date, fields.startTime, fields.endTime);
  if (slotError) {
    return Response.json({ error: slotError }, { status: 400 });
  }

  const property = await prisma.property.findUnique({ where: { id: body.propertyId } });
  if (!property) {
    return Response.json({ error: '対象の物件が見つかりません。' }, { status: 404 });
  }

  // ③⑤ 内見予約（未承認を含む）・他の社内案内予約と重なる枠は登録不可
  const conflicts = await findConflicts(
    body.propertyId,
    fields.date,
    fields.startTime,
    fields.endTime,
    { includePendingReservations: true }
  );
  if (conflicts.length > 0) {
    return Response.json(
      { error: conflictMessage(fields.date, conflicts), conflicts },
      { status: 409 }
    );
  }

  const booking = await prisma.internalBooking.create({
    data: {
      propertyId: body.propertyId,
      propertyName: property.name,
      staffName: fields.staffName,
      date: fields.date,
      startTime: fields.startTime,
      endTime: fields.endTime,
      notes: fields.notes,
      createdBy: session.name,
    },
  });

  // ② 社内案内予約もLINE WORKSカレンダーへ登録する（イベントIDは後の日時変更・キャンセル同期用に保存）
  const eventId = await createCalendarEvent({
    category: '社内案内',
    propertyName: booking.propertyName,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    companyName: '（社内案内）',
    agentName: booking.staffName,
    phone: '',
    notes: booking.notes,
  });
  if (eventId !== null) {
    await prisma.internalBooking.update({
      where: { id: booking.id },
      data: { calendarEventId: eventId || 'registered' },
    });
  }

  return Response.json(booking, { status: 201 });
}
