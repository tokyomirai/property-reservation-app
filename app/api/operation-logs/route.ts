import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { type NextRequest } from 'next/server';

// 予約の操作履歴（監査ログ）取得。社内ログイン必須。
// ?targetType=reservation|internalBooking&targetId=<id> で対象を指定する。
// 古い順（発生順）に返し、画面側で「誰がいつ何をしたか」を時系列表示する。
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get('targetType') ?? '';
  const targetId = searchParams.get('targetId') ?? '';

  if (!targetId || (targetType !== 'reservation' && targetType !== 'internalBooking')) {
    return Response.json({ error: 'targetType と targetId を正しく指定してください。' }, { status: 400 });
  }

  const logs = await prisma.operationLog.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: 'asc' },
  });
  return Response.json(logs);
}
