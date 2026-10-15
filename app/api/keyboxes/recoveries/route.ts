import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { type NextRequest } from 'next/server';

// キーボックス回収の一覧（社内のみ）。
// ?status=回収待ち（既定）/ 回収済み / すべて で絞り込む。
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') ?? '回収待ち').trim();
  const where = status === 'すべて' ? {} : { status };

  const recoveries = await prisma.keyBoxRecovery.findMany({
    where,
    orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
  });
  return Response.json(recoveries);
}
