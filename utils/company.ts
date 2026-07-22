// utils/company.ts
// 自社情報。メール本文と画面表示の両方から参照する（クライアント側からも import 可）。

export const COMPANY_NAME = '株式会社東京みらい不動産';
export const COMPANY_PHONE = '03-6457-8925';
export const COMPANY_FAX = '03-6457-8975';
export const COMPANY_POSTAL = '〒160-0022';
export const COMPANY_ADDRESS = '東京都新宿区新宿1丁目17-6';
export const COMPANY_URL = 'https://www.tokyorf.com/';

/** 予約の変更・キャンセルはシステムからは行えず、電話受付のみである旨の案内。 */
export const CANCEL_NOTICE_TITLE = 'ご予約の変更・キャンセルについて';
export const CANCEL_NOTICE_BODY =
  `ご予約時間の変更またはキャンセルをご希望の場合は、システムからの変更はできません。` +
  `お手数ですが、${COMPANY_NAME}（TEL：${COMPANY_PHONE}）までお電話にてご連絡ください。`;
