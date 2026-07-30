import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { validatePropertyLinks } from '../../../../utils/propertyLinks';
import { type NextRequest } from 'next/server';

// GET: 物件詳細取得（公開・管理者両用）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();

  try {
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return Response.json({ error: 'Property not found' }, { status: 404 });
    }

    if (session) {
      return Response.json(property);
    } else {
      // 非公開、または「仕入決済前」（公開・販売不可）の物件は公開側に出さない
      if (!property.isPublished || property.salesStatus === '仕入決済前') {
        return Response.json({ error: 'Property not found or not available' }, { status: 404 });
      }
      // 公開表示時はセキュリティ情報および管理情報を除外
      const { unlockCode, keyBoxNumber, setupLocation, hasKeyBox, hasSlippers, hasSignboard, internalMemo, salesRepEmail, lastUpdatedBy, ...safeProperty } = property;
      return Response.json(safeProperty);
    }
  } catch (err) {
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT: 物件更新（管理者のみ）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  // 公開導線URL（詳細資料/動画/360°）の形式検証。空欄は許容。
  const linkError = validatePropertyLinks({
    documentUrl: body.documentUrl ?? '',
    youtubeUrl: body.youtubeUrl ?? '',
    panoramaUrl: body.panoramaUrl ?? '',
  });
  if (linkError) {
    return Response.json({ error: linkError }, { status: 400 });
  }

  try {
    const property = await prisma.property.update({
      where: { id },
      data: {
        name: body.name,
        address: body.address,
        salesStatus: body.salesStatus,
        viewingStatus: body.viewingStatus,
        isPublished: body.isPublished,
        hasKeyBox: body.hasKeyBox,
        keyBoxNumber: body.keyBoxNumber,
        unlockCode: body.unlockCode,
        setupLocation: body.setupLocation,
        hasSlippers: body.hasSlippers,
        hasSignboard: body.hasSignboard,
        notes: body.notes,
        internalMemo: body.internalMemo,
        salesRepEmail: body.salesRepEmail,
        documentUrl: body.documentUrl,
        youtubeUrl: body.youtubeUrl,
        panoramaUrl: body.panoramaUrl,
        lastUpdatedBy: session.name,
      },
    });
    return Response.json(property);
  } catch {
    return Response.json({ error: 'Property not found' }, { status: 404 });
  }
}

// DELETE: 物件削除（管理者のみ）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  try {
    await prisma.property.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Property not found' }, { status: 404 });
  }
}
