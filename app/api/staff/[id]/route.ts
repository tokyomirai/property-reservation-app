import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { parseStaffInput } from '../../../../utils/staff';
import { type NextRequest } from 'next/server';

// PUT: 担当者情報の更新（社内のみ）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const parsed = parseStaffInput(body);
  if ('error' in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // 名刺を差し替えない更新では既存の名刺データを保持する。
  // 「削除」を指定された場合のみ空にする。
  const f = parsed.fields;
  const base = {
    name: f.name,
    email: f.email,
    companyPhone: f.companyPhone,
    mobilePhone: f.mobilePhone,
    isActive: f.isActive,
  };
  const data = f.cardData
    ? { ...base, cardData: f.cardData, cardFileName: f.cardFileName, cardMimeType: f.cardMimeType }
    : body.removeCard
    ? { ...base, cardData: '', cardFileName: '', cardMimeType: '' }
    : base;

  try {
    const updated = await prisma.staff.update({ where: { id }, data });
    const { cardData: stored, ...safe } = updated;
    return Response.json({ ...safe, hasCard: stored !== '' });
  } catch {
    return Response.json({ error: 'Staff not found' }, { status: 404 });
  }
}

// DELETE: 担当者の削除（社内のみ）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  try {
    await prisma.staff.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Staff not found' }, { status: 404 });
  }
}
