import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { sendApprovalEmail } from '../../../../utils/mail';
import { createCalendarEvent } from '../../../../utils/lineworks';
import { findConflicts, conflictMessage } from '../../../../utils/schedule';
import { type NextRequest } from 'next/server';

// 鍵情報の開示ステータス
export type KeyDisclosure = '開示中' | '未承認' | '期間前' | '期間終了' | '日付不明';

/**
 * 鍵情報を開示してよいかを判定する。
 * 承認済み かつ 内見日の「前日00:00(JST)〜翌日00:00(JST)」の期間内のみ開示する。
 * 予約詳細URLが第三者に転送されても、期間外は鍵情報が表示されないようにするための制御。
 */
function getKeyDisclosure(status: string, preferredDate: string): KeyDisclosure {
  if (status !== '承認済') return '未承認';

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

// PATCH: 予約ステータス更新（管理者のみ）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  if (!['未承認', '承認済', '却下'].includes(body.status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 });
  }

  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: 'Reservation not found' }, { status: 404 });
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
      data: { status: body.status },
      include: {
        property: {
          select: {
            hasKeyBox: true,
            keyBoxNumber: true,
            unlockCode: true,
            setupLocation: true,
            salesRepEmail: true,
          },
        },
      },
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
    await prisma.reservation.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Reservation not found' }, { status: 404 });
  }
}
