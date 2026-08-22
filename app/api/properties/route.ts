import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { validatePropertyLinks } from '../../../utils/propertyLinks';
import { normalizeViewingStartDate } from '../../../utils/viewingWindow';
import { type NextRequest } from 'next/server';

// 公開側に返すフィールド（鍵情報・社内メモは除外）
const PUBLIC_SELECT = {
  id: true,
  name: true,
  address: true,
  salesStatus: true,
  viewingStatus: true,
  // 内見受付開始日（公開画面での日付制御・案内表示に使用）
  viewingStartDate: true,
  isPublished: true,
  notes: true,
  // 公開カードの資料/動画/パノラマ導線（公開用URL）
  documentUrl: true,
  youtubeUrl: true,
  panoramaUrl: true,
  createdAt: true,
  updatedAt: true,
  // 除外: unlockCode, keyBoxNumber, setupLocation, hasKeyBox, hasSlippers, hasSignboard, internalMemo, salesRepEmail, lastUpdatedBy
};

// GET: 物件一覧取得
// 管理者: 全物件・全フィールド / 公開: 公開物件のみ・安全なフィールドのみ
export async function GET(request: NextRequest) {
  const session = await getSession();

  try {
    if (session) {
      // 管理者: 全フィールド・全物件
      const properties = await prisma.property.findMany({
        orderBy: { createdAt: 'asc' },
      });
      return Response.json(properties);
    } else {
      // 公開: isPublished=true のみ、安全なフィールドのみ。
      // 「仕入決済前」（契約済だが決済前で公開・販売不可）は公開一覧に出さない。
      const properties = await prisma.property.findMany({
        where: {
          isPublished: true,
          salesStatus: { not: '仕入決済前' },
        },
        select: PUBLIC_SELECT,
        orderBy: { createdAt: 'asc' },
      });
      return Response.json(properties);
    }
  } catch (error: any) {
    return Response.json({ error: String(error), stack: error.stack }, { status: 500 });
  }
}

// POST: 物件新規作成（管理者のみ）
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

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

  const property = await prisma.property.create({
    data: {
      name: body.name,
      address: body.address ?? '',
      salesStatus: body.salesStatus ?? '販売中',
      viewingStatus: body.viewingStatus ?? '内見可能',
      // 空欄・不正値は NULL（＝日付制限なし）として保存する
      viewingStartDate: normalizeViewingStartDate(body.viewingStartDate) || null,
      isPublished: body.isPublished ?? true,
      hasKeyBox: body.hasKeyBox ?? '',
      keyBoxNumber: body.keyBoxNumber ?? '',
      unlockCode: body.unlockCode ?? '',
      setupLocation: body.setupLocation ?? '',
      hasSlippers: body.hasSlippers ?? '',
      hasSignboard: body.hasSignboard ?? '',
      notes: body.notes ?? '',
      internalMemo: body.internalMemo ?? '',
      salesRepEmail: body.salesRepEmail ?? '',
      documentUrl: body.documentUrl ?? '',
      youtubeUrl: body.youtubeUrl ?? '',
      panoramaUrl: body.panoramaUrl ?? '',
      lastUpdatedBy: session.name,
    },
  });
  return Response.json(property, { status: 201 });
}
