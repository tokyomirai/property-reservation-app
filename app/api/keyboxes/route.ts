import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { normalizeKb } from '../../../utils/keybox';
import { type NextRequest } from 'next/server';

// キーボックス番号マスタ（社内保有のKB番号）。社内ログイン必須。

// GET: マスタ一覧（社内のみ）
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const keyboxes = await prisma.keyBox.findMany({ orderBy: { createdAt: 'asc' } });
  return Response.json(keyboxes);
}

// POST: マスタ番号の追加（社内のみ）
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const number = normalizeKb(body.number);
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
  const storageLocation = typeof body.storageLocation === 'string' ? body.storageLocation.trim() : '';

  if (!number) {
    return Response.json({ error: 'キーボックス番号を入力してください。' }, { status: 400 });
  }
  if (number === '00' || number === '金') {
    return Response.json(
      { error: '「00」「金」は当社在庫の対象外のため、マスタには登録できません。' },
      { status: 400 }
    );
  }
  if (number.length > 20) {
    return Response.json({ error: 'キーボックス番号が長すぎます。' }, { status: 400 });
  }

  const exists = await prisma.keyBox.findUnique({ where: { number } });
  if (exists) {
    return Response.json({ error: `番号「${number}」は既に登録されています。` }, { status: 409 });
  }

  const created = await prisma.keyBox.create({ data: { number, notes, isActive, storageLocation } });
  return Response.json(created, { status: 201 });
}
