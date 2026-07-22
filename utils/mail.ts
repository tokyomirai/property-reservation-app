// utils/mail.ts
import { Resend } from 'resend';
import { type Reservation } from '@prisma/client';
import {
  COMPANY_NAME,
  COMPANY_PHONE,
  COMPANY_FAX,
  COMPANY_POSTAL,
  COMPANY_ADDRESS,
  COMPANY_URL,
  CANCEL_NOTICE_TITLE,
} from './company';
import { formatTimeRange } from './schedule';

// 内見予約が入った際の通知先（社内）
const NOTIFY_TO = 'info@tokyomf.co.jp';

// 送信元アドレス。
// - Resendのドメイン認証(DNS)が未完了の間は 'onboarding@resend.dev' を使用（ただし送信先はResend登録アドレスに限定される）
// - tokyomf.co.jp のドメイン認証完了後は RESEND_FROM に 'no-reply@tokyomf.co.jp' 等を設定
const FROM = process.env.RESEND_FROM || '東京みらい不動産 予約通知 <onboarding@resend.dev>';

/** メール本文に埋め込む文字列をHTMLエスケープする。 */
function esc(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 予約の時間表記。開始・終了が入っていればそちらを優先する。 */
function timeLabel(reservation: Reservation): string {
  const range = formatTimeRange(reservation.startTime, reservation.endTime);
  return range || reservation.preferredTime || '（未入力）';
}

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
    `■ 会社電話番号  : ${reservation.phone || '（未入力）'}`,
    `■ 担当者携帯番号: ${reservation.mobilePhone || '（未入力）'}`,
    `■ メールアドレス: ${reservation.email}`,
    `■ 名刺          : ${reservation.cardFileName ? `${reservation.cardFileName}（管理画面から確認できます）` : '（添付なし）'}`,
    `■ 内見希望日    : ${reservation.preferredDate || '（未入力）'}`,
    `■ 内見希望時間  : ${timeLabel(reservation)}`,
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
 * 承認メールの件名・本文（テキスト／HTML）を組み立てる。
 * 送信処理から切り離すことで、送信せずに内容を確認できるようにしている。
 * @param reservation 承認された予約
 * @param property 物件の鍵情報（キーボックス番号・解除番号・設置場所）
 */
export function buildApprovalEmail(
  reservation: Reservation,
  property: KeyInfo
): { subject: string; text: string; html: string } {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
  const detailUrl = appUrl
    ? `${appUrl}/broker/reservation/${reservation.id}`
    : '(予約詳細URL未設定)';

  const subject = '【内見確定】内見のご案内と鍵情報のお知らせ（東京みらい不動産）';
  const when = `${reservation.preferredDate} ${timeLabel(reservation)}`;

  // セキュリティ保護のため、鍵情報（解除番号等）はメール本文には記載しない。
  // メールは永久に受信箱へ残り、転送も容易なため、鍵情報は期間限定のWeb画面でのみ開示する。
  const hasKeyBox = property?.hasKeyBox === 'あり';

  const keyBlockText = hasKeyBox
    ? [
        '本物件はキーボックスでの鍵受け渡しとなります。',
        'キーボックスの暗証番号・設置場所は、下記の予約詳細ページにてご確認ください。',
        '',
        `　${detailUrl}`,
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '　鍵情報は【内見日の前日から当日まで】のみ表示されます。',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '※ 内見日の前日になりましたら、上記ページを開いてご確認ください。',
      ].join('\n')
    : '本物件はキーボックスを使用しない鍵受け渡しとなります。担当者より別途ご案内いたします。';

  // 弊社の連絡先（変更・キャンセルの受付窓口）
  const contactTextLines = [`会社：${COMPANY_PHONE}`];

  const text = [
    '╔══════════════════════════════════╗',
    `　【${CANCEL_NOTICE_TITLE}】`,
    '╚══════════════════════════════════╝',
    'ご予約時間の変更またはキャンセルをご希望の場合は、',
    'システムからの変更はできません。',
    `お手数ですが、${COMPANY_NAME}（TEL：${COMPANY_PHONE}）まで`,
    'お電話にてご連絡ください。',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
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
    `【日時】 ${when}`,
    `【予約詳細照会URL】 ${detailUrl}`,
    '',
    '■ お問い合わせ先',
    ...contactTextLines,
    '',
    '■ 鍵の受け渡しについて',
    keyBlockText,
    '',
    '■ 注意事項',
    '・内見終了後は、必ずキーボックスに鍵を戻し、ダイヤルをランダムに回して施錠を確認してください。',
    '・電気・エアコンをご利用になった場合は、退室時に必ず消灯・停止してください。',
    '・現地備品（スリッパ・売り看板など）は持ち出さないようお願いいたします。',
    '',
    'よろしくお願い申し上げます。',
    '',
    '--------------------------------------------------',
    COMPANY_NAME,
    '',
    COMPANY_POSTAL,
    COMPANY_ADDRESS,
    `TEL：${COMPANY_PHONE}`,
    `FAX：${COMPANY_FAX}`,
    `HP：${COMPANY_URL}`,
    '--------------------------------------------------',
  ].join('\n');

  const keyBlockHtml = hasKeyBox
    ? `<p style="margin:0 0 10px;">本物件はキーボックスでの鍵受け渡しとなります。<br />
         キーボックスの暗証番号・設置場所は、下記の予約詳細ページにてご確認ください。</p>
       <p style="margin:0 0 10px;"><a href="${esc(detailUrl)}" style="color:#4f46e5;">${esc(detailUrl)}</a></p>
       <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;font-size:13px;">
         鍵情報は<strong>【内見日の前日から当日まで】</strong>のみ表示されます。<br />
         内見日の前日になりましたら、上記ページを開いてご確認ください。
       </div>`
    : `<p style="margin:0;">本物件はキーボックスを使用しない鍵受け渡しとなります。担当者より別途ご案内いたします。</p>`;

  const contactRowsHtml =
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap;">会社</td>
         <td style="padding:4px 0;font-weight:bold;color:#0f172a;">${esc(COMPANY_PHONE)}</td></tr>`;

  // ① 変更・キャンセルの案内は、開封して最初に目に入るよう本文最上部に枠付きで配置する
  const html = `<div style="font-family:'Hiragino Sans','Yu Gothic',sans-serif;color:#1e293b;font-size:14px;line-height:1.8;max-width:640px;">

  <div style="border:3px solid #dc2626;background:#fef2f2;border-radius:10px;padding:16px 18px;margin:0 0 24px;">
    <div style="font-size:15px;font-weight:bold;color:#b91c1c;margin-bottom:8px;">
      【${esc(CANCEL_NOTICE_TITLE)}】
    </div>
    <div style="color:#7f1d1d;font-size:13.5px;">
      ご予約時間の変更またはキャンセルをご希望の場合は、<strong>システムからの変更はできません。</strong><br />
      お手数ですが、<strong>${esc(COMPANY_NAME)}（TEL：<a href="tel:${esc(
        COMPANY_PHONE.replace(/-/g, '')
      )}" style="color:#b91c1c;">${esc(COMPANY_PHONE)}</a>）</strong>までお電話にてご連絡ください。
    </div>
  </div>

  <p style="margin:0 0 4px;">${esc(reservation.companyName)}</p>
  <p style="margin:0 0 16px;">${esc(reservation.agentName)} 様</p>

  <p style="margin:0 0 16px;">
    いつも大変お世話になっております。<br />
    東京みらい不動産でございます。<br /><br />
    お申込みいただきました下記物件の内見希望につきまして、以下の通りご案内を確定いたしました。
  </p>

  <h3 style="font-size:14px;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">■ 内見概要</h3>
  <table style="border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap;">物件名</td>
        <td style="padding:4px 0;font-weight:bold;color:#0f172a;">${esc(reservation.propertyName)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap;">日時</td>
        <td style="padding:4px 0;font-weight:bold;color:#0f172a;">${esc(when)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap;">予約詳細</td>
        <td style="padding:4px 0;"><a href="${esc(detailUrl)}" style="color:#4f46e5;">${esc(detailUrl)}</a></td></tr>
  </table>

  <h3 style="font-size:14px;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">■ お問い合わせ先</h3>
  <table style="border-collapse:collapse;font-size:14px;">${contactRowsHtml}</table>

  <h3 style="font-size:14px;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">■ 鍵の受け渡しについて</h3>
  ${keyBlockHtml}

  <h3 style="font-size:14px;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">■ 注意事項</h3>
  <ul style="margin:0;padding-left:20px;">
    <li>内見終了後は、必ずキーボックスに鍵を戻し、ダイヤルをランダムに回して施錠を確認してください。</li>
    <li>電気・エアコンをご利用になった場合は、退室時に必ず消灯・停止してください。</li>
    <li>現地備品（スリッパ・売り看板など）は持ち出さないようお願いいたします。</li>
  </ul>

  <p style="margin:24px 0 0;">よろしくお願い申し上げます。</p>

  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#475569;font-size:13px;">
    <strong style="color:#0f172a;">${esc(COMPANY_NAME)}</strong><br />
    ${esc(COMPANY_POSTAL)} ${esc(COMPANY_ADDRESS)}<br />
    TEL：${esc(COMPANY_PHONE)}　FAX：${esc(COMPANY_FAX)}<br />
    HP：<a href="${esc(COMPANY_URL)}" style="color:#4f46e5;">${esc(COMPANY_URL)}</a>
  </div>
</div>`;

  return { subject, text, html };
}

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

  const { subject, text, html } = buildApprovalEmail(reservation, property);

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
      html,
    });

    if (error) {
      console.error('❌ 承認メール送信エラー(Resend):', error);
      return;
    }
    console.log(`✅ 承認メール送信成功 (id: ${data?.id}) → ${to}`);
  } catch (err) {
    // メール送信失敗が承認処理自体を止めないよう握りつぶす
    console.error('❌ 承認メール送信で例外:', err);
  }
}
