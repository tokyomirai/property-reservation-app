import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { type NextRequest } from 'next/server';

// GET: 予約一覧（管理者のみ）
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const reservations = await prisma.reservation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { property: { select: { name: true } } },
  });
  return Response.json(reservations);
}

// POST: 予約申込（公開）
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.propertyId || !body.companyName || !body.agentName || !body.email) {
    return Response.json({ error: 'Required fields missing' }, { status: 400 });
  }

  // 物件の存在確認（公開物件のみ受付）
  const property = await prisma.property.findFirst({
    where: { id: body.propertyId, isPublished: true },
  });

  if (!property) {
    return Response.json({ error: 'Property not found or not available' }, { status: 404 });
  }

  const reservation = await prisma.reservation.create({
    data: {
      propertyId: body.propertyId,
      propertyName: property.name,
      companyName: body.companyName,
      agentName: body.agentName,
      phone: body.phone ?? '',
      email: body.email,
      preferredDate: body.preferredDate ?? '',
      preferredTime: body.preferredTime ?? '',
      notes: body.notes ?? '',
    },
  });

  return Response.json(reservation, { status: 201 });
}
