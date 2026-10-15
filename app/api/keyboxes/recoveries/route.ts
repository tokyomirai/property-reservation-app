import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { type NextRequest } from 'next/server';

// キーボックス回収/返却の一覧（社内のみ）。
// ?status= pending（回収待ち＋返却待ち） / done（回収済み＋返却済み） / すべて / 個別ステータス
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') ?? 'pending').trim();
  const where =
    status === 'すべて' ? {}
    : status === 'pending' ? { status: { in: ['回収待ち', '返却待ち'] } }
    : status === 'done' ? { status: { in: ['回収済み', '返却済み'] } }
    : { status };

  const recoveries = await prisma.keyBoxRecovery.findMany({
    where,
    orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
  });
  return Response.json(recoveries);
}
