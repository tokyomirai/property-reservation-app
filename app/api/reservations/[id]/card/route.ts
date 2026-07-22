import { prisma } from '../../../../../utils/db';
import { getSession, unauthorized } from '../../../../../utils/session';
import { type NextRequest } from 'next/server';

// GET: 申込時にアップロードされた名刺を取得する。
// 名刺は個人情報を含むため社内ログイン必須とし、公開側には一切返さない。
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    select: { cardFileName: true, cardMimeType: true, cardData: true },
  });

  if (!reservation || !reservation.cardData) {
    return Response.json({ error: '名刺データが登録されていません。' }, { status: 404 });
  }

  const bytes = Buffer.from(reservation.cardData, 'base64');

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': reservation.cardMimeType || 'application/octet-stream',
      // ブラウザ内で表示（PDF・画像とも）。ファイル名は保存時に使われる。
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(reservation.cardFileName || 'meishi')}`,
      'Content-Length': String(bytes.length),
      // 個人情報のためキャッシュさせない
      'Cache-Control': 'private, no-store',
    },
  });
}
