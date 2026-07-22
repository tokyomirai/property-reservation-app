import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { parseStaffInput } from '../../../utils/staff';
import { type NextRequest } from 'next/server';

// ⑥⑦ 担当者マスタ。承認メールに載せる電話番号と、添付する名刺データを担当者ごとに保持する。
// 社内ログイン必須（携帯番号・名刺は社内情報のため公開しない）。

// GET: 担当者一覧（社内のみ）
// 名刺の実データは一覧では返さず、登録の有無のみを返す（レスポンス肥大の防止）
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const staff = await prisma.staff.findMany({ orderBy: { createdAt: 'asc' } });
  return Response.json(
    staff.map(({ cardData, ...rest }) => ({ ...rest, hasCard: cardData !== '' }))
  );
}

// POST: 担当者の新規登録（社内のみ）
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = parseStaffInput(body);
  if ('error' in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.staff.findUnique({ where: { email: parsed.fields.email } });
  if (existing) {
    return Response.json(
      { error: 'このメールアドレスの担当者は既に登録されています。' },
      { status: 409 }
    );
  }

  const created = await prisma.staff.create({ data: parsed.fields });
  const { cardData, ...rest } = created;
  return Response.json({ ...rest, hasCard: cardData !== '' }, { status: 201 });
}
