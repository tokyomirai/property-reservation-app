import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { type NextRequest } from 'next/server';

// 公開側に返すフィールド（鍵情報・社内メモは除外）
const PUBLIC_SELECT = {
  id: true,
  name: true,
  address: true,
  salesStatus: true,
  viewingStatus: true,
  isPublished: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  // 除外: unlockCode, keyBoxNumber, setupLocation, hasKeyBox, hasSlippers, hasSignboard, internalMemo, lastUpdatedBy
};

// GET: 物件一覧取得
// 管理者: 全物件・全フィールド / 公開: 公開物件のみ・安全なフィールドのみ
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (session) {
    // 管理者: 全フィールド・全物件
    const properties = await prisma.property.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return Response.json(properties);
  } else {
    // 公開: isPublished=true のみ、安全なフィールドのみ
    const properties = await prisma.property.findMany({
      where: { isPublished: true },
      select: PUBLIC_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return Response.json(properties);
  }
}

// POST: 物件新規作成（管理者のみ）
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const property = await prisma.property.create({
    data: {
      name: body.name,
      address: body.address ?? '',
      salesStatus: body.salesStatus ?? '販売中',
      viewingStatus: body.viewingStatus ?? '内見可能',
      isPublished: body.isPublished ?? true,
      hasKeyBox: body.hasKeyBox ?? '',
      keyBoxNumber: body.keyBoxNumber ?? '',
      unlockCode: body.unlockCode ?? '',
      setupLocation: body.setupLocation ?? '',
      hasSlippers: body.hasSlippers ?? '',
      hasSignboard: body.hasSignboard ?? '',
      notes: body.notes ?? '',
      internalMemo: body.internalMemo ?? '',
      lastUpdatedBy: session.name,
    },
  });
  return Response.json(property, { status: 201 });
}
