import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { createCalendarEvent } from '../../../utils/lineworks';
import { validateSlot, findConflicts, conflictMessage } from '../../../utils/schedule';
import { type NextRequest } from 'next/server';

// 手動予約（自社案内 / 仲介案内アプリ外）。仲介会社には一切公開せず、社内ログイン時のみ操作できる。

const MAX_LEN: Record<string, number> = {
  staffName: 50,
  companyName: 100,
  agentName: 50,
  phone: 30,
  mobilePhone: 30,
  email: 254,
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

  // 予約種別（自社案内 / 仲介案内）。不正値は自社案内にフォールバック。
  const bookingType = body.bookingType === '仲介案内' ? '仲介案内' : '自社案内';
  const isBroker = bookingType === '仲介案内';

  // 種別に応じて保存する項目を切り替える（切替時に他方の値が誤って保存されないよう、
  // 該当種別のフィールドのみ採用し、他方は空文字で保存する）。
  const fields = {
    staffName: isBroker ? '' : toStr(body.staffName),
    companyName: isBroker ? toStr(body.companyName) : '',
    agentName: isBroker ? toStr(body.agentName) : '',
    phone: isBroker ? toStr(body.phone) : '',
    mobilePhone: isBroker ? toStr(body.mobilePhone) : '',
    email: isBroker ? toStr(body.email) : '',
    date: toStr(body.date),
    startTime: toStr(body.startTime),
    endTime: toStr(body.endTime),
    notes: toStr(body.notes),
  };

  if (!body.propertyId) {
    return Response.json({ error: '物件は必須項目です。' }, { status: 400 });
  }
  if (isBroker) {
    if (!fields.companyName || !fields.agentName) {
      return Response.json({ error: '仲介会社名とご担当者名は必須項目です。' }, { status: 400 });
    }
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      return Response.json({ error: 'メールアドレスの形式が正しくありません。' }, { status: 400 });
    }
  } else if (!fields.staffName) {
    return Response.json({ error: '自社案内の担当者は必須項目です。' }, { status: 400 });
  }

  for (const [key, max] of Object.entries(MAX_LEN)) {
    if ((fields[key as keyof typeof fields] ?? '').length > max) {
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
      bookingType,
      staffName: fields.staffName,
      companyName: fields.companyName,
      agentName: fields.agentName,
      phone: fields.phone,
      mobilePhone: fields.mobilePhone,
      email: fields.email,
      date: fields.date,
      startTime: fields.startTime,
      endTime: fields.endTime,
      notes: fields.notes,
      createdBy: session.name,
    },
  });

  // 手動予約もLINE WORKSカレンダーへ登録する（イベントIDは後の日時変更・キャンセル同期用に保存）
  const eventId = await createCalendarEvent({
    category: isBroker ? '仲介案内（アプリ外）' : '自社案内',
    propertyName: booking.propertyName,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    companyName: isBroker ? booking.companyName : '（自社案内）',
    agentName: isBroker ? booking.agentName : booking.staffName,
    phone: booking.phone,
    mobilePhone: booking.mobilePhone,
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
