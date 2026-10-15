import { prisma } from '../../../../../utils/db';
import { getSession, unauthorized } from '../../../../../utils/session';
import { recordKeyBoxHistory } from '../../../../../utils/keybox';
import { type NextRequest } from 'next/server';

// 回収/返却を「完了」にする／「待ち」へ戻す（社内のみ）。所有区分で挙動を分ける。
//   自社: 回収完了＝社内在庫へ戻す（保管場所を記録） / 他社(金): 返却完了＝在庫に戻さない（保管場所なし）
//   body.action: 'complete' | 'reopen'
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action === 'reopen' ? 'reopen' : 'complete';
  const storageLocation = typeof body.storageLocation === 'string' ? body.storageLocation.trim() : '';

  const existing = await prisma.keyBoxRecovery.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: '対象の記録が見つかりません。' }, { status: 404 });
  const isOther = existing.ownership === '他社';

  try {
    const data = action === 'complete'
      ? {
          status: isOther ? '返却済み' : '回収済み',
          recoveredBy: session.name,
          recoveredAt: new Date(),
          recoveredLocation: isOther ? '' : storageLocation,
        }
      : {
          status: isOther ? '返却待ち' : '回収待ち',
          recoveredBy: '', recoveredAt: null, recoveredLocation: '',
        };
    const updated = await prisma.keyBoxRecovery.update({ where: { id }, data });

    if (action === 'complete' && updated.itemType === 'キーボックス') {
      // 自社のみ社内在庫マスタの保管場所を更新（他社は在庫に戻さない）
      if (!isOther && storageLocation) {
        await prisma.keyBox.updateMany({ where: { number: updated.keyBoxNumber }, data: { storageLocation } });
      }
      await recordKeyBoxHistory({
        keyBoxNumber: updated.keyBoxNumber,
        action: isOther ? '返却' : '回収',
        propertyId: updated.propertyId,
        propertyName: updated.propertyName,
        setupLocation: isOther ? '' : (storageLocation || ''),
        unlockCode: updated.unlockCode,
        operator: session.name,
      });
    }
    return Response.json(updated);
  } catch {
    return Response.json({ error: '対象の記録が見つかりません。' }, { status: 404 });
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
