// utils/mail.ts
import { Resend } from 'resend';
import { type Reservation } from '@prisma/client';

// 内見予約が入った際の通知先（社内）
const NOTIFY_TO = 'info@tokyomf.co.jp';

// 送信元アドレス。
// - Resendのドメイン認証(DNS)が未完了の間は 'onboarding@resend.dev' を使用（ただし送信先はResend登録アドレスに限定される）
// - tokyomf.co.jp のドメイン認証完了後は RESEND_FROM に 'no-reply@tokyomf.co.jp' 等を設定
const FROM = process.env.RESEND_FROM || '東京みらい不動産 予約通知 <onboarding@resend.dev>';

/**
 * 内見予約が入ったことを社内（info@）と物件担当営業へ通知する。
 * @param reservation 作成された予約
 * @param salesRepEmail 物件に登録された担当営業メール（未登録なら空文字/undefined）
 */
export async function sendReservationEmail(
  reservation: Reservation,
  salesRepEmail?: string | null
) {
  const apiKey = process.env.RESEND_API_KEY;

  // 宛先: info@ ＋ 担当営業（空・重複は除外）
  const recipients = Array.from(
    new Set(
      [NOTIFY_TO, salesRepEmail]
        .map((e) => (e ?? '').trim())
        .filter((e) => e !== '')
    )
  );

  if (!apiKey) {
    // APIキー未設定時は送信せずモック出力（ローカル開発・未設定環境向け）
    console.warn('⚠️ RESEND_API_KEY 未設定のため予約通知メールをスキップ（モック出力）:', {
      to: recipients,
      subject: `【内見予約】${reservation.propertyName} / ${reservation.companyName}`,
      reservationId: reservation.id,
    });
    return;
  }

  const resend = new Resend(apiKey);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
  const adminUrl = appUrl ? `${appUrl}/admin` : '(管理画面URL未設定)';

  const subject = `【内見予約】${reservation.propertyName} / ${reservation.companyName}`;

  const text = [
    '内見予約の申込みが入りました。管理画面よりご確認・ご承認ください。',
    '',
    '─────────────────────',
    `■ 物件名        : ${reservation.propertyName}`,
    `■ 仲介業者名    : ${reservation.companyName}`,
    `■ ご担当者名    : ${reservation.agentName} 様`,
    `■ 電話番号      : ${reservation.phone || '（未入力）'}`,
    `■ メールアドレス: ${reservation.email}`,
    `■ 内見希望日    : ${reservation.preferredDate || '（未入力）'}`,
    `■ 内見希望時間  : ${reservation.preferredTime || '（未入力）'}`,
    `■ その他連絡事項: ${reservation.notes || '（なし）'}`,
    '─────────────────────',
    '',
    `▼ 承認はこちら（社内管理画面）`,
    adminUrl,
    '',
    '※ 本メールは内見予約フォームからの自動送信です。',
    '　 このメールに返信すると、申込者（仲介担当者）へ直接返信されます。',
    '─────────────────────',
    '物件確認・内見受付・現況管理システム',
  ].join('\n');

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: recipients,
      replyTo: reservation.email, // 返信すると申込者へ届く
      subject,
      text,
    });

    if (error) {
      console.error('❌ 予約通知メール送信エラー(Resend):', error);
      return;
    }
    console.log(`✅ 予約通知メール送信成功 (id: ${data?.id}) → ${recipients.join(', ')}`);
  } catch (err) {
    // メール送信失敗が予約自体を失敗させないよう、ここで握りつぶす
    console.error('❌ 予約通知メール送信で例外:', err);
  }
}

// 承認時に付与される物件の鍵情報
type KeyInfo = {
  hasKeyBox: string;
  keyBoxNumber: string;
  unlockCode: string;
  setupLocation: string;
} | null | undefined;

/**
 * 内見予約が「承認済」になった際に、申込者（仲介担当者）へ
 * 内見確定・鍵情報のメールを送信する。
 * @param reservation 承認された予約
 * @param property 物件の鍵情報（キーボックス番号・解除番号・設置場所）
 */
export async function sendApprovalEmail(reservation: Reservation, property: KeyInfo) {
  const apiKey = process.env.RESEND_API_KEY;

  const to = (reservation.email ?? '').trim();
  if (!to) {
    console.warn('⚠️ 申込者メールアドレスが空のため承認メールをスキップ:', reservation.id);
    return;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
  const detailUrl = appUrl
    ? `${appUrl}/broker/reservation/${reservation.id}`
    : '(予約詳細URL未設定)';

  const subject = '【内見確定】内見のご案内と鍵情報のお知らせ（東京みらい不動産）';

  // セキュリティ保護のため、鍵情報（解除番号等）はメール本文には記載しない。
  // メールは永久に受信箱へ残り、転送も容易なため、鍵情報は期間限定のWeb画面でのみ開示する。
  const keyBlock =
    property?.hasKeyBox === 'あり'
      ? [
          '本物件はキーボックスでの鍵受け渡しとなります。',
          'キーボックスの暗証番号・設置場所は、下記の予約詳細ページにてご確認ください。',
          '',
          `　${detailUrl}`,
          '',
          '※ セキュリティ保護のため、鍵情報は【内見日の前日から当日まで】のみ表示されます。',
          '※ 内見日の前日になりましたら、上記ページを開いてご確認ください。',
        ].join('\n')
      : '本物件はキーボックスを使用しない鍵受け渡しとなります。担当者より別途ご案内いたします。';

  const text = [
    `${reservation.companyName}`,
    `${reservation.agentName} 様`,
    '',
    'いつも大変お世話になっております。',
    '東京みらい不動産でございます。',
    '',
    'お申込みいただきました下記物件の内見希望につきまして、以下の通りご案内を確定いたしました。',
    '',
    '■ 内見概要',
    `【物件名】 ${reservation.propertyName}`,
    `【日時】 ${reservation.preferredDate} ${reservation.preferredTime}`,
    `【予約詳細照会URL】 ${detailUrl}`,
    '',
    '■ 鍵の受け渡しについて',
    keyBlock,
    '',
    '■ 注意事項',
    '・内見終了後は、必ずキーボックスに鍵を戻し、ダイヤルをランダムに回して施錠を確認してください。',
    '・電気・エアコンをご利用になった場合は、退室時に必ず消灯・停止してください。',
    '・現地備品（スリッパ・売り看板など）は持ち出さないようお願いいたします。',
    '',
    'よろしくお願い申し上げます。',
    '--------------------------------------------------',
    '東京みらい不動産 営業部',
    '--------------------------------------------------',
  ].join('\n');

  if (!apiKey) {
    console.warn('⚠️ RESEND_API_KEY 未設定のため承認メールをスキップ（モック出力）:', {
      to,
      subject,
      reservationId: reservation.id,
    });
    return;
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      replyTo: NOTIFY_TO, // 返信すると社内(info@)へ届く
      subject,
      text,
    });

    if (error) {
      console.error('❌ 承認メール送信エラー(Resend):', error);
      return;
    }
    console.log(`✅ 承認メール送信成功 (id: ${data?.id}) → ${to}`);
  } catch (err) {
    // メール送信失敗が承認処理自体を失敗させないよう握りつぶす
    console.error('❌ 承認メール送信で例外:', err);
  }
}
