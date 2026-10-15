import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { normalizeKb } from '../../../../utils/keybox';
import { type NextRequest } from 'next/server';

// PUT: マスタ番号の更新（社内のみ）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const number = normalizeKb(body.number);
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
  // storageLocation は指定時のみ更新（未指定なら既存値を保持）
  const storageLocation = typeof body.storageLocation === 'string' ? body.storageLocation.trim() : undefined;

  if (!number) {
    return Response.json({ error: 'キーボックス番号を入力してください。' }, { status: 400 });
  }
  if (number === '00' || number === '金') {
    return Response.json(
      { error: '「00」「金」は当社在庫の対象外のため、マスタには登録できません。' },
      { status: 400 }
    );
  }

  // 別レコードが同じ番号を使っていないか
  const dup = await prisma.keyBox.findFirst({ where: { number, id: { not: id } } });
  if (dup) {
    return Response.json({ error: `番号「${number}」は既に登録されています。` }, { status: 409 });
  }

  try {
    const updated = await prisma.keyBox.update({
      where: { id },
      data: { number, notes, isActive, ...(storageLocation !== undefined ? { storageLocation } : {}) },
    });
    return Response.json(updated);
  } catch {
    return Response.json({ error: 'KeyBox not found' }, { status: 404 });
  }
}

// DELETE: マスタ番号の削除（社内のみ）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  try {
    await prisma.keyBox.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'KeyBox not found' }, { status: 404 });
  }
}
