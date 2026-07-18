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
