import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { normalizeKb } from '../../../../utils/keybox';
import { type NextRequest } from 'next/server';

// キーボックス使用履歴（設置・変更・解除・回収）の取得（社内のみ）。
// ?number=XXXX でその番号の履歴を新しい順に返す。
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const number = normalizeKb(searchParams.get('number'));
  if (!number) {
    return Response.json({ error: 'number を指定してください。' }, { status: 400 });
  }

  const history = await prisma.keyBoxHistory.findMany({
    where: { keyBoxNumber: number },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json(history);
}
