import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../../../../utils/lineworks';
import { validateSlot, findConflicts, conflictMessage, formatTimeRange } from '../../../../utils/schedule';
import { recordOperationLog, processedByFields } from '../../../../utils/operationLog';
import { type NextRequest } from 'next/server';

// PATCH: 社内案内予約の更新（社内のみ）
//   - { reschedule: { date?, startTime, endTime } } … 日時変更
//   - { status: '確定' | 'キャンセル' } … ステータス変更（キャンセル＝枠を空ける／履歴は残す）
// 既存の登録・削除・カレンダー表示には影響しない追加機能。
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.internalBooking.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: 'Internal booking not found' }, { status: 404 });
  }

  // ── 日時変更 ──
  if (body.reschedule) {
    const date = String(body.reschedule.date ?? existing.date).trim();
    const startTime = String(body.reschedule.startTime ?? '').trim();
    const endTime = String(body.reschedule.endTime ?? '').trim();

    const slotError = validateSlot(date, startTime, endTime);
    if (slotError) {
      return Response.json({ error: slotError }, { status: 400 });
    }

    // 変更後の枠が他の確定予約（内見予約[未承認含む]・他の社内案内）と重ならないか確認（自分自身は除外）
    const conflicts = await findConflicts(existing.propertyId, date, startTime, endTime, {
      excludeInternalBookingId: id,
      includePendingReservations: true,
    });
    if (conflicts.length > 0) {
      return Response.json(
        { error: conflictMessage(date, conflicts), conflicts },
        { status: 409 }
      );
    }

    const updated = await prisma.internalBooking.update({
      where: { id },
      data: { date, startTime, endTime, status: '確定', ...processedByFields(session) },
    });

    // 操作履歴（日時変更）: 変更前・変更後の日付＋時間帯
    await recordOperationLog(session, {
      targetType: 'internalBooking',
      targetId: id,
      action: '日時変更',
      beforeValue: `${existing.date} ${formatTimeRange(existing.startTime, existing.endTime)}`,
      afterValue: `${date} ${formatTimeRange(startTime, endTime)}`,
    });

    // LINE WORKSカレンダーを同期（未設定のローカルでは自動スキップ）
    const isBroker = updated.bookingType === '仲介案内';
    const evtInput = {
      category: isBroker ? '仲介案内（アプリ外）' : '自社案内',
      propertyName: updated.propertyName,
      date: updated.date,
      startTime: updated.startTime,
      endTime: updated.endTime,
      companyName: isBroker ? updated.companyName : '（自社案内）',
      agentName: isBroker ? updated.agentName : updated.staffName,
      phone: updated.phone,
      mobilePhone: updated.mobilePhone,
      notes: updated.notes,
    };
    if (updated.calendarEventId) {
      await updateCalendarEvent(updated.calendarEventId, evtInput);
    } else {
      const eventId = await createCalendarEvent(evtInput);
      if (eventId !== null) {
        await prisma.internalBooking.update({
          where: { id },
          data: { calendarEventId: eventId || 'registered' },
        });
      }
    }

    return Response.json(updated);
  }

  // ── ステータス変更（確定／キャンセル） ──
  if (!['確定', 'キャンセル'].includes(body.status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 });
  }

  const updated = await prisma.internalBooking.update({
    where: { id },
    data: { status: body.status, ...processedByFields(session) },
  });

  // 操作履歴（確定/キャンセル）: 変更前後のステータス
  await recordOperationLog(session, {
    targetType: 'internalBooking',
    targetId: id,
    action: body.status,
    beforeValue: existing.status,
    afterValue: body.status,
  });

  // キャンセル時は確定していたカレンダー予定を削除して枠を空ける（レコードは履歴として残す）。
  if (body.status === 'キャンセル' && updated.calendarEventId) {
    await deleteCalendarEvent(updated.calendarEventId);
    await prisma.internalBooking.update({ where: { id }, data: { calendarEventId: '' } });
  }

  return Response.json(updated);
}

// DELETE: 社内案内予約の削除（社内のみ）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  try {
    // 削除前に内容を控えて操作履歴を残す（レコード削除後もログは残る）
    const existing = await prisma.internalBooking.findUnique({ where: { id } });
    await prisma.internalBooking.delete({ where: { id } });
    if (existing) {
      const who = existing.bookingType === '仲介案内' ? existing.companyName : existing.staffName;
      await recordOperationLog(session, {
        targetType: 'internalBooking',
        targetId: id,
        action: '削除',
        beforeValue: `${existing.bookingType}／${existing.propertyName}／${who}／${existing.date} ${formatTimeRange(existing.startTime, existing.endTime)}`,
        afterValue: '（削除）',
      });
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Internal booking not found' }, { status: 404 });
  }
}
