// utils/businessCard.ts
// 内見申込フォームでアップロードされる名刺（JPG / PNG / PDF）の検証。
// 公開フォームから受け取るため、形式とサイズを必ずサーバー側で検証する。

export const ALLOWED_CARD_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;

/** アップロード上限（実ファイルサイズ）。5MB。 */
export const MAX_CARD_BYTES = 5 * 1024 * 1024;

/** Base64は元データの約4/3になるため、その分の余裕をみた文字数上限。 */
export const MAX_CARD_BASE64_LEN = Math.ceil((MAX_CARD_BYTES * 4) / 3) + 1024;

/** 画面表示用の許可形式（例: 「JPG・PNG・PDF」）。 */
export const ALLOWED_CARD_LABEL = 'JPG・PNG・PDF';

export interface CardInput {
  cardFileName: string;
  cardMimeType: string;
  cardData: string;
}

/**
 * 名刺の入力値を検証する。未アップロード（空）は許容する。
 * @returns 問題があればエラーメッセージ、なければ null
 */
export function validateCard(card: CardInput): string | null {
  const { cardFileName, cardMimeType, cardData } = card;

  // 3項目とも空＝未アップロード
  if (!cardData && !cardFileName && !cardMimeType) return null;

  if (!cardData) return '名刺ファイルの読み込みに失敗しました。再度お試しください。';
  if (!cardFileName) return '名刺のファイル名が取得できませんでした。';
  if (!(ALLOWED_CARD_TYPES as readonly string[]).includes(cardMimeType)) {
    return `名刺は ${ALLOWED_CARD_LABEL} のいずれかの形式でアップロードしてください。`;
  }
  if (cardData.length > MAX_CARD_BASE64_LEN) {
    return '名刺ファイルのサイズが大きすぎます（5MBまで）。';
  }
  // Base64として解釈できない値を弾く
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cardData)) {
    return '名刺ファイルの形式が正しくありません。';
  }
  return null;
}

/** 拡張子から表示用のラベルを返す。 */
export function cardKindLabel(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/png') return 'PNG';
  if (mimeType === 'image/jpeg') return 'JPG';
  return 'ファイル';
}
