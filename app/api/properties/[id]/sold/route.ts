import { prisma } from '../../../../../utils/db';
import { getSession, unauthorized } from '../../../../../utils/session';
import { normalizeKb, isCompanyKb } from '../../../../../utils/keybox';
import { type NextRequest } from 'next/server';

// 物件を「売却済み」にする／解除する（社内のみ）。物理削除はしない。
// 売却済み化＝ soldAt セット＋非公開（isPublished=false）。一覧除外・新規予約停止はこのフラグで効く。
// キーボックスがある物件は回収状況を受け取り、KeyBoxRecovery に記録する。

// POST: 売却済みにする（備品の回収確認を同時に処理）
//   body.recoveries: { 'キーボックス'?: boolean, 'スリッパ'?: boolean, '売り看板'?: boolean }
//     true=回収済み（記録を残す。KBは社内在庫へ戻る） / false=未回収（回収待ちに残す）
//   登録されている備品ごとに回収状況を受け取り、未指定の備品はエラーにする。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const choices = (body.recoveries ?? {}) as Record<string, unknown>;
  // キーボックスを「回収済み」にした場合の戻し先（4F または自由入力）。空なら 4F。
  const keyboxLocation = typeof body.keyboxLocation === 'string' && body.keyboxLocation.trim() ? body.keyboxLocation.trim() : '4F';

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) {
    return Response.json({ error: '対象の物件が見つかりません。' }, { status: 404 });
  }
  if (property.soldAt) {
    return Response.json({ error: 'この物件は既に売却済みです。' }, { status: 409 });
  }

  const kbNumber = normalizeKb(property.keyBoxNumber);
  const hasCompanyKb = property.hasKeyBox === 'あり' && isCompanyKb(kbNumber);

  // この物件に登録されている備品（＝回収確認の対象）だけを列挙する
  const items: { itemType: string; keyBoxNumber: string; setupLocation: string; unlockCode: string }[] = [];
  if (hasCompanyKb) items.push({ itemType: 'キーボックス', keyBoxNumber: kbNumber, setupLocation: property.setupLocation, unlockCode: property.unlockCode });
  if (property.hasSlippers === 'あり') items.push({ itemType: 'スリッパ', keyBoxNumber: '', setupLocation: '', unlockCode: '' });
  if (property.hasSignboard === 'あり') items.push({ itemType: '売り看板', keyBoxNumber: '', setupLocation: '', unlockCode: '' });

  // 登録備品は必ず回収状況（true/false）が指定されていること（未選択は不可）
  for (const it of items) {
    if (typeof choices[it.itemType] !== 'boolean') {
      return Response.json({ error: `「${it.itemType}」の回収状況を選択してください。` }, { status: 400 });
    }
  }

  // 備品ごとに回収記録を作成（回収済み＝日時/回収者/戻し先を記録、未回収＝回収待ちで残す）
  for (const it of items) {
    const recovered = choices[it.itemType] === true;
    // 回収済みキーボックスの戻し先は画面で指定した保管場所（未指定は4F）。社内在庫マスタの現在地も更新する。
    const recoveredLocation = recovered && it.itemType === 'キーボックス' ? keyboxLocation : '';
    await prisma.keyBoxRecovery.create({
      data: {
        itemType: it.itemType,
        keyBoxNumber: it.keyBoxNumber,
        propertyId: property.id,
        propertyName: property.name,
        propertyAddress: property.address,
        setupLocation: it.setupLocation,
        unlockCode: it.unlockCode,
        status: recovered ? '回収済み' : '回収待ち',
        requestedBy: session.name,
        recoveredBy: recovered ? session.name : '',
        recoveredAt: recovered ? new Date() : null,
        recoveredLocation,
        notes: '',
      },
    });
    if (recovered && it.itemType === 'キーボックス') {
      await prisma.keyBox.updateMany({ where: { number: it.keyBoxNumber }, data: { storageLocation: keyboxLocation } });
    }
  }

  const updated = await prisma.property.update({
    where: { id },
    data: {
      soldAt: new Date(),
      soldBy: session.name,
      // 売却済みは公開停止（新規予約停止・一覧除外はこのフラグ＋soldAtで効く）
      isPublished: false,
    },
  });
  return Response.json(updated);
}

// DELETE: 売却済みを解除する（誤操作時の復元）。物件・予約履歴はそのまま。
// 回収待ちレコードは自動では消さない（在庫・回収状況は回収管理側で確認・操作する）。
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  try {
    const updated = await prisma.property.update({
      where: { id },
      data: { soldAt: null, soldBy: '' },
    });
    return Response.json(updated);
  } catch {
    return Response.json({ error: '対象の物件が見つかりません。' }, { status: 404 });
  }
}
