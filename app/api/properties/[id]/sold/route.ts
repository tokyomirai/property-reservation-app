import { prisma } from '../../../../../utils/db';
import { getSession, unauthorized } from '../../../../../utils/session';
import { normalizeKb, isNoneNumber, isKinNumber, recordKeyBoxHistory } from '../../../../../utils/keybox';
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
  // キーボックスが設置されていれば、当社/他社(金)に関わらず確認対象にする（番号なし=空/00のみ対象外）。
  const hasKb = property.hasKeyBox === 'あり' && !isNoneNumber(kbNumber);
  const kbOwnership = isKinNumber(kbNumber) ? '他社' : '自社';

  // この物件に登録されている備品（＝確認対象）を列挙する
  const items: { itemType: string; ownership: string; keyBoxNumber: string; setupLocation: string; unlockCode: string }[] = [];
  if (hasKb) items.push({ itemType: 'キーボックス', ownership: kbOwnership, keyBoxNumber: kbNumber, setupLocation: property.setupLocation, unlockCode: property.unlockCode });
  if (property.hasSlippers === 'あり') items.push({ itemType: 'スリッパ', ownership: '自社', keyBoxNumber: '', setupLocation: '', unlockCode: '' });
  if (property.hasSignboard === 'あり') items.push({ itemType: '売り看板', ownership: '自社', keyBoxNumber: '', setupLocation: '', unlockCode: '' });

  // 登録備品は必ず回収/返却状況（true/false）が指定されていること（未選択は不可）
  for (const it of items) {
    if (typeof choices[it.itemType] !== 'boolean') {
      return Response.json({ error: `「${it.itemType}」の状況を選択してください。` }, { status: 400 });
    }
  }

  // 備品ごとに記録を作成。
  //   自社KB: 回収済み/回収待ち（回収済みは保管場所＋社内在庫へ）／他社KB(金): 返却済み/返却待ち（在庫に戻さない・保管場所なし）
  for (const it of items) {
    const done = choices[it.itemType] === true;
    const isOtherKb = it.itemType === 'キーボックス' && it.ownership === '他社';
    const status = isOtherKb ? (done ? '返却済み' : '返却待ち') : (done ? '回収済み' : '回収待ち');
    const recoveredLocation = done && it.itemType === 'キーボックス' && it.ownership === '自社' ? keyboxLocation : '';
    await prisma.keyBoxRecovery.create({
      data: {
        itemType: it.itemType,
        ownership: it.ownership,
        keyBoxNumber: it.keyBoxNumber,
        propertyId: property.id,
        propertyName: property.name,
        propertyAddress: property.address,
        setupLocation: it.setupLocation,
        unlockCode: it.unlockCode,
        status,
        requestedBy: session.name,
        recoveredBy: done ? session.name : '',
        recoveredAt: done ? new Date() : null,
        recoveredLocation,
        notes: '',
      },
    });
    if (done && it.itemType === 'キーボックス') {
      if (it.ownership === '自社') {
        // 自社KBは指定の保管場所で社内在庫へ戻す
        await prisma.keyBox.updateMany({ where: { number: it.keyBoxNumber }, data: { storageLocation: keyboxLocation } });
      }
      // 履歴（自社=回収／他社=返却）
      await recordKeyBoxHistory({
        keyBoxNumber: it.keyBoxNumber,
        action: it.ownership === '他社' ? '返却' : '回収',
        propertyId: property.id,
        propertyName: property.name,
        setupLocation: it.ownership === '自社' ? keyboxLocation : '',
        unlockCode: it.unlockCode,
        operator: session.name,
      });
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
