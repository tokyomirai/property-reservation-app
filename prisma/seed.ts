import { prisma } from '../utils/db';

async function main() {
  console.log('🌱 初期データを投入中...');

  // 既存データをクリア
  await prisma.reservation.deleteMany();
  await prisma.property.deleteMany();

  // 初期物件データ
  const prop1 = await prisma.property.create({
    data: {
      name: '千代田ファーストビル 701号室',
      address: '東京都千代田区麹町1-2-3',
      salesStatus: '販売中',
      viewingStatus: '内見可能',
      isPublished: true,
      hasKeyBox: 'あり',
      keyBoxNumber: '1',
      unlockCode: '5521',
      setupLocation: '玄関扉横のメーターボックス内',
      hasSlippers: 'あり',
      hasSignboard: 'なし',
      notes: '室内クリーニング済み。即案内可能です。スリッパは室内玄関に設置してあります。',
      internalMemo: '',
      lastUpdatedBy: '山田 太郎',
    },
  });

  const prop2 = await prisma.property.create({
    data: {
      name: '恵比寿サウスレジデンス 305号室',
      address: '東京都渋谷区恵比寿南2-5-5',
      salesStatus: '申込あり',
      viewingStatus: '日程調整',
      isPublished: true,
      hasKeyBox: 'あり',
      keyBoxNumber: '2',
      unlockCode: '',
      setupLocation: '',
      hasSlippers: 'なし',
      hasSignboard: 'なし',
      notes: '現在2番手の内見予約のみ受け付けております。日程は事前調整が必要です。',
      internalMemo: '',
      lastUpdatedBy: '鈴木 一郎',
    },
  });

  await prisma.property.create({
    data: {
      name: 'レジディア新宿 1202号室',
      address: '東京都新宿区西新宿3-10-1',
      salesStatus: '販売中',
      viewingStatus: 'リフォーム中',
      isPublished: true,
      hasKeyBox: '',
      keyBoxNumber: '',
      unlockCode: '',
      setupLocation: '',
      hasSlippers: '',
      hasSignboard: '',
      notes: '現在クロス貼り替え工事中。工事完了後に内見可能となります。',
      internalMemo: '',
      lastUpdatedBy: '田中 次郎',
    },
  });

  // サンプル予約
  await prisma.reservation.create({
    data: {
      propertyId: prop2.id,
      propertyName: prop2.name,
      companyName: 'ABC不動産',
      agentName: '佐藤 健',
      phone: '090-1234-5678',
      email: 'sato@abc-realestate.co.jp',
      preferredDate: '2026-06-30',
      preferredTime: '13:00〜14:00',
      notes: 'お客様同伴で現地にて直行直帰で内見希望です。',
      status: '未承認',
    },
  });

  console.log('✅ 初期データ投入完了');
  console.log(`  - 物件: 3件`);
  console.log(`  - 予約: 1件`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
