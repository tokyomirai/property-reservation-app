import { prisma } from '../../../../../utils/db';
import { getSession, unauthorized } from '../../../../../utils/session';
import { recordKeyBoxHistory } from '../../../../../utils/keybox';
import { type NextRequest } from 'next/server';

// 回収完了にする／回収待ちへ戻す（社内のみ）。
//   body.action: 'complete'（回収完了＝社内在庫へ戻す） | 'reopen'（回収待ちへ戻す）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action === 'reopen' ? 'reopen' : 'complete';
  // キーボックスの回収完了時に戻す社内保管場所（"4F" または自由入力）。省略時は未設定のまま。
  const storageLocation = typeof body.storageLocation === 'string' ? body.storageLocation.trim() : '';

  try {
    const updated = await prisma.keyBoxRecovery.update({
      where: { id },
      data:
        action === 'complete'
          ? { status: '回収済み', recoveredBy: session.name, recoveredAt: new Date(), recoveredLocation: storageLocation }
          : { status: '回収待ち', recoveredBy: '', recoveredAt: null, recoveredLocation: '' },
    });
    // キーボックスを回収完了したら、社内在庫マスタの保管場所を更新し、使用履歴に「回収」を記録する
    if (action === 'complete' && updated.itemType === 'キーボックス') {
      if (storageLocation) {
        await prisma.keyBox.updateMany({ where: { number: updated.keyBoxNumber }, data: { storageLocation } });
      }
      await recordKeyBoxHistory({
        keyBoxNumber: updated.keyBoxNumber,
        action: '回収',
        propertyId: updated.propertyId,
        propertyName: updated.propertyName,
        setupLocation: storageLocation || '',
        unlockCode: updated.unlockCode,
        operator: session.name,
      });
    }
    return Response.json(updated);
  } catch {
    return Response.json({ error: '対象の回収記録が見つかりません。' }, { status: 404 });
  }
}

// 回収記録の削除（社内のみ・整理用）。
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  try {
    await prisma.keyBoxRecovery.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: '対象の回収記録が見つかりません。' }, { status: 404 });
  }
}
