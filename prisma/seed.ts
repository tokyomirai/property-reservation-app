import { prisma } from '../utils/db';

async function main() {
  console.log('🌱 本番環境の初期化中（データクリーンアップ）...');

  // 本番運用開始時は既存のサンプルデータをクリアします
  await prisma.reservation.deleteMany();
  await prisma.property.deleteMany();

  console.log('✅ データベースのクリーンアップが完了しました。');
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

