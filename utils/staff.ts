// utils/staff.ts
// 担当者マスタ（⑥ 電話番号表示 / ⑦ 名刺添付）の入力検証。

// 名刺データ（Base64）の上限。メール添付の実用範囲として2MB相当までとする。
export const MAX_CARD_BASE64_LEN = 2 * 1024 * 1024;
const ALLOWED_CARD_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];

const toStr = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export interface StaffFields {
  name: string;
  email: string;
  companyPhone: string;
  mobilePhone: string;
  cardFileName: string;
  cardMimeType: string;
  cardData: string;
  isActive: boolean;
}

/** 担当者の入力値を検証・正規化する。エラーがあればメッセージを返す。 */
export function parseStaffInput(
  body: Record<string, unknown>
): { fields: StaffFields } | { error: string } {
  const fields: StaffFields = {
    name: toStr(body.name),
    email: toStr(body.email).toLowerCase(),
    companyPhone: toStr(body.companyPhone),
    mobilePhone: toStr(body.mobilePhone),
    cardFileName: toStr(body.cardFileName),
    cardMimeType: toStr(body.cardMimeType),
    cardData: toStr(body.cardData),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };

  if (!fields.name) return { error: '担当者名は必須です。' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return { error: 'メールアドレスの形式が正しくありません。' };
  }
  if (fields.cardData) {
    if (!ALLOWED_CARD_TYPES.includes(fields.cardMimeType)) {
      return { error: '名刺は PNG / JPG / PDF のいずれかを添付してください。' };
    }
    if (fields.cardData.length > MAX_CARD_BASE64_LEN) {
      return { error: '名刺ファイルのサイズが大きすぎます（約1.5MBまで）。' };
    }
    if (!fields.cardFileName) {
      return { error: '名刺のファイル名が取得できませんでした。' };
    }
  }

  return { fields };
}
