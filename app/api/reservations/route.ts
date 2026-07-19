import { prisma } from '../../../utils/db';
import { getSession, unauthorized } from '../../../utils/session';
import { sendReservationEmail } from '../../../utils/mail';
import { rateLimit, getClientIp } from '../../../utils/rateLimit';
import { type NextRequest } from 'next/server';

// GET: 予約一覧（管理者のみ）
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const reservations = await prisma.reservation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { property: { select: { name: true } } },
  });
  return Response.json(reservations);
}

// --- 公開エンドポイントの濫用対策 ---
const IP_LIMIT = 5;                        // 同一IPから
const IP_WINDOW_MS = 10 * 60 * 1000;       // 10分間に5件まで
const GLOBAL_HOURLY_LIMIT = 30;            // 全体で1時間に30件まで（メール送信枠の保護）

// 各項目の最大文字数
const MAX_LEN: Record<string, number> = {
  companyName: 100,
  agentName: 50,
  phone: 30,
  email: 254,
  preferredDate: 20,
  preferredTime: 40,
  notes: 1000,
};

const toStr = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// POST: 予約申込（公開）
export async function POST(request: NextRequest) {
  // 1. IP単位のレート制限（連投・ボット対策）
  const ip = getClientIp(request);
  const rl = rateLimit(`reservation:${ip}`, IP_LIMIT, IP_WINDOW_MS);
  if (!rl.ok) {
    return Response.json(
      { error: '短時間に多数のお申込みが行われました。しばらく時間をおいて再度お試しください。' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const body = await request.json();

  // 2. ハニーポット（人間には見えない項目。入力されていればボットと判断）
  if (toStr(body.website) !== '') {
    return Response.json({ error: 'Invalid submission' }, { status: 400 });
  }

  // 3. 入力値の正規化・検証
  const fields = {
    companyName: toStr(body.companyName),
    agentName: toStr(body.agentName),
    phone: toStr(body.phone),
    email: toStr(body.email),
    preferredDate: toStr(body.preferredDate),
    preferredTime: toStr(body.preferredTime),
    notes: toStr(body.notes),
  };

  if (!body.propertyId || !fields.companyName || !fields.agentName || !fields.email) {
    return Response.json({ error: 'Required fields missing' }, { status: 400 });
  }

  for (const [key, max] of Object.entries(MAX_LEN)) {
    if (fields[key as keyof typeof fields].length > max) {
      return Response.json(
        { error: `入力内容が長すぎます（${key} は${max}文字以内で入力してください）。` },
        { status: 400 }
      );
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return Response.json({ error: 'メールアドレスの形式が正しくありません。' }, { status: 400 });
  }

  // 4. 全体の流量制限（分散した大量送信からメール送信枠を保護）
  const recentCount = await prisma.reservation.count({
    where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recentCount >= GLOBAL_HOURLY_LIMIT) {
    return Response.json(
      { error: '現在お申込みが集中しております。お手数ですが、しばらく時間をおいて再度お試しください。' },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
  }

  // 物件の存在確認（公開物件のみ受付）
  const property = await prisma.property.findFirst({
    where: { id: body.propertyId, isPublished: true },
  });

  if (!property) {
    return Response.json({ error: 'Property not found or not available' }, { status: 404 });
  }

  const reservation = await prisma.reservation.create({
    data: {
      propertyId: body.propertyId,
      propertyName: property.name,
      companyName: fields.companyName,
      agentName: fields.agentName,
      phone: fields.phone,
      email: fields.email,
      preferredDate: fields.preferredDate,
      preferredTime: fields.preferredTime,
      notes: fields.notes,
    },
  });

  // 内見予約通知メールを info@ ＋ 物件担当営業へ送信（失敗しても予約自体は成立させる）
  await sendReservationEmail(reservation, property.salesRepEmail);

  return Response.json(reservation, { status: 201 });
}
