import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { type NextRequest } from 'next/server';

// GET: 予約詳細（公開）
// 承認済みの場合のみ鍵情報をサーバーサイドで付与
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          address: true,
          hasKeyBox: true,
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

  // 承認済みでない場合は鍵情報をマスク
  const isApproved = reservation.status === '承認済';
  const safeProperty = reservation.property
    ? {
        ...reservation.property,
        keyBoxNumber: isApproved ? reservation.property.keyBoxNumber : null,
        unlockCode: isApproved ? reservation.property.unlockCode : null,
        setupLocation: isApproved ? reservation.property.setupLocation : null,
      }
    : null;

  return Response.json({
    ...reservation,
    property: safeProperty,
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
          },
        },
      },
    });
    return Response.json(reservation);
  } catch {
    return Response.json({ error: 'Reservation not found' }, { status: 404 });
  }
}
