import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { sendApprovalEmail } from '../../../../utils/mail';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../../../../utils/lineworks';
import { findConflicts, conflictMessage, validateSlot, formatTimeRange } from '../../../../utils/schedule';
import { recordOperationLog, processedByFields, reservationActionLabel } from '../../../../utils/operationLog';
import { type NextRequest } from 'next/server';

// 鍵情報の開示ステータス
export type KeyDisclosure = '開示中' | '未承認' | '期間前' | '期間終了' | '日付不明';

/**
 * 鍵情報を開示してよいかを判定する。
 * 承認済み かつ 内見日の「前日00:00(JST)〜翌日00:00(JST)」の期間内のみ開示する。
 * 予約詳細URLが第三者に転送されても、期間外は鍵情報が表示されないようにするための制御。
 */
function getKeyDisclosure(status: string, preferredDate: string): KeyDisclosure {
  // 承認済・日時変更（時間だけ変更した確定予約）のみ鍵情報を開示対象とする。
  if (status !== '承認済' && status !== '日時変更') return '未承認';

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((preferredDate ?? '').trim());
  if (!m) return '日付不明';

  const DAY = 24 * 60 * 60 * 1000;
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  // 内見日 00:00(JST) を UTC ミリ秒で表現
  const viewingJstMidnight =
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - JST_OFFSET;

  const from = viewingJstMidnight - DAY; // 前日 00:00 JST から
  const to = viewingJstMidnight + DAY;   // 翌日 00:00 JST まで
  const now = Date.now();

  if (now < from) return '期間前';
  if (now >= to) return '期間終了';
  return '開示中';
}

// GET: 予約詳細（公開）
// 鍵情報は「承認済み かつ 内見日前後の期間内」のみ付与（管理者ログイン時は常に閲覧可）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          address: true,
          hasKeyBox: true,
          salesRepEmail: true,
          // 鍵情報は承認後のみ付与（後述のロジックで制御）
          keyBoxNumber: true,
          unlockCode: true,
          setupLocation: true,
        },
      },
    },
  });

  if (!reservation) {
    return Response.json({ error: 'Reservation not found' }, { status: 404 });
  }

  // 鍵情報の開示可否を判定（管理者は常に閲覧可）
  const keyDisclosure = getKeyDisclosure(reservation.status, reservation.preferredDate);
  const canSeeKey = session ? true : keyDisclosure === '開示中';

  const safeProperty = reservation.property
    ? {
        ...reservation.property,
        // 担当営業メールは社内情報のため公開側には返さない
        salesRepEmail: session ? reservation.property.salesRepEmail : undefined,
        keyBoxNumber: canSeeKey ? reservation.property.keyBoxNumber : null,
        unlockCode: canSeeKey ? reservation.property.unlockCode : null,
        setupLocation: canSeeKey ? reservation.property.setupLocation : null,
      }
    : null;

  // 名刺の実データはレスポンスに含めない（社内ログイン時のみ /card から取得できる）
  const { cardData, ...rest } = reservation;

  return Response.json({
    ...rest,
    hasCard: cardData !== '',
    property: safeProperty,
    keyDisclosure,
  });
}

// PATCH: 予約の更新（管理者のみ）
//   - { reschedule: { preferredDate?, startTime, endTime } } … 日時変更（開始・終了・日付を変更）
//   - { status } … ステータス変更（未承認 / 承認済 / 日時変更 / キャンセル / 却下）
// 既存の承認フロー（承認メール・カレンダー登録）は従来どおり維持する。
const ALLOWED_STATUSES = ['未承認', '承認済', '日時変更', 'キャンセル', '却下'];
const PROPERTY_SELECT = {
  hasKeyBox: true,
  keyBoxNumber: true,
  unlockCode: true,
  setupLocation: true,
  salesRepEmail: true,
} as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: 'Reservation not found' }, { status: 404 });
  }

  // ───────────────────────────────────────────────
  // 日時変更（電話連絡などで日時だけ変更したケース）
  //   DB更新 → カレンダー更新 → 予約情報を返す。ステータスは「日時変更」に。
  // ───────────────────────────────────────────────
  if (body.reschedule) {
    const date = String(body.reschedule.preferredDate ?? existing.preferredDate).trim();
    const startTime = String(body.reschedule.startTime ?? '').trim();
    const endTime = String(body.reschedule.endTime ?? '').trim();

    const slotError = validateSlot(date, startTime, endTime);
    if (slotError) {
      return Response.json({ error: slotError }, { status: 400 });
    }

    // 変更後の枠が他の確定予約（承認済・日時変更・社内案内）と重ならないか確認（自分自身は除外）
    const conflicts = await findConflicts(existing.propertyId, date, startTime, endTime, {
      excludeReservationId: id,
    });
    if (conflicts.length > 0) {
      return Response.json(
        { error: conflictMessage(date, conflicts), conflicts },
        { status: 409 }
      );
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        preferredDate: date,
        startTime,
        endTime,
        preferredTime: formatTimeRange(startTime, endTime),
        status: '日時変更',
        ...processedByFields(session),
      },
      include: { property: { select: PROPERTY_SELECT } },
    });

    // 操作履歴（日時変更）: 変更前・変更後の日付＋時間帯を残す
    await recordOperationLog(session, {
      targetType: 'reservation',
      targetId: id,
      action: '日時変更',
      beforeValue: `${existing.preferredDate} ${formatTimeRange(existing.startTime, existing.endTime)}`,
      afterValue: `${date} ${formatTimeRange(startTime, endTime)}`,
    });

    // LINE WORKSカレンダーを同期（未設定のローカルでは自動スキップ）。既存イベントは更新、無ければ新規作成。
    const evtInput = {
      category: '内見',
      propertyName: updated.propertyName,
      date: updated.preferredDate,
      startTime: updated.startTime,
      endTime: updated.endTime,
      companyName: updated.companyName,
      agentName: updated.agentName,
      phone: updated.phone,
      mobilePhone: updated.mobilePhone,
      notes: updated.notes,
    };
    if (updated.calendarEventId) {
      await updateCalendarEvent(updated.calendarEventId, evtInput);
    } else {
      const eventId = await createCalendarEvent(evtInput);
      if (eventId !== null) {
        await prisma.reservation.update({
          where: { id },
          data: { calendarEventId: eventId || 'registered' },
        });
      }
    }

    return Response.json(updated);
  }

  // ───────────────────────────────────────────────
  // ステータス変更
  // ───────────────────────────────────────────────
  if (!ALLOWED_STATUSES.includes(body.status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 });
  }

  // ③ 承認時点で他の確定予約と枠が重なっていないか再確認する。
  //    （申込～承認の間に社内案内予約などが入るケースがあるため）
  if (body.status === '承認済') {
    const conflicts = await findConflicts(
      existing.propertyId,
      existing.preferredDate,
      existing.startTime,
      existing.endTime,
      { excludeReservationId: id }
    );
    if (conflicts.length > 0) {
      return Response.json(
        { error: conflictMessage(existing.preferredDate, conflicts), conflicts },
        { status: 409 }
      );
    }
  }

  try {
    const reservation = await prisma.reservation.update({
      where: { id },
      data: { status: body.status, ...processedByFields(session) },
      include: { property: { select: PROPERTY_SELECT } },
    });

    // 操作履歴（承認/却下/キャンセル等）: 変更前後のステータスを残す
    await recordOperationLog(session, {
      targetType: 'reservation',
      targetId: id,
      action: reservationActionLabel(body.status),
      beforeValue: existing.status,
      afterValue: body.status,
    });

    if (body.status === '承認済') {
      // 申込者へ内見確定・鍵情報メールを送信（送信失敗は承認処理自体を止めない）
      await sendApprovalEmail(reservation, reservation.property);

      // ② 確定した内見予約をLINE WORKSカレンダーへ登録（重複登録は行わない）
      if (!reservation.calendarEventId) {
        const eventId = await createCalendarEvent({
          category: '内見',
          propertyName: reservation.propertyName,
          date: reservation.preferredDate,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
          companyName: reservation.companyName,
          agentName: reservation.agentName,
          phone: reservation.phone,
          mobilePhone: reservation.mobilePhone,
          notes: reservation.notes,
        });
        if (eventId !== null) {
          await prisma.reservation.update({
            where: { id },
            // イベントIDが取得できない場合も登録済みの印として値を入れる
            data: { calendarEventId: eventId || 'registered' },
          });
        }
      }
    }

    // キャンセル（仲介都合）・却下（弊社都合）は枠を空ける：確定していたカレンダー予定を削除する。
    // 予約レコード自体は削除せず履歴として残す（ステータスで判別）。
    if (body.status === 'キャンセル' || body.status === '却下') {
      if (reservation.calendarEventId) {
        await deleteCalendarEvent(reservation.calendarEventId);
        await prisma.reservation.update({ where: { id }, data: { calendarEventId: '' } });
      }
    }

    return Response.json(reservation);
  } catch {
    return Response.json({ error: 'Reservation not found' }, { status: 404 });
  }
}

// DELETE: 予約削除（管理者のみ）
// テストデータの整理など、不要になった予約レコードを削除する
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  try {
    // 削除前に内容を控えて操作履歴を残す（レコード削除後もログは残る）
    const existing = await prisma.reservation.findUnique({ where: { id } });
    await prisma.reservation.delete({ where: { id } });
    if (existing) {
      await recordOperationLog(session, {
        targetType: 'reservation',
        targetId: id,
        action: '削除',
        beforeValue: `${existing.status}／${existing.propertyName}／${existing.preferredDate} ${formatTimeRange(existing.startTime, existing.endTime)}`,
        afterValue: '（削除）',
      });
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Reservation not found' }, { status: 404 });
  }
}
