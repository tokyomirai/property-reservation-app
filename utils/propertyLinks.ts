// utils/propertyLinks.ts
// 公開物件カードの導線URL（詳細資料 / ルームツアー動画 / 360°カメラ）の検証。
// サーバー側（保存時）とクライアント側（入力時）で共通に使う。

export interface PropertyLinks {
  documentUrl: string;
  youtubeUrl: string;
  panoramaUrl: string;
}

export const LINK_LABELS: Record<keyof PropertyLinks, string> = {
  documentUrl: '詳細資料URL',
  youtubeUrl: 'ルームツアー動画URL',
  panoramaUrl: '360°カメラURL',
};

/**
 * 3つの導線URLを検証する。空欄は許容（未登録＝公開側は「準備中」）。
 * @returns 不正があれば分かりやすい日本語メッセージ、問題なければ null
 */
export function validatePropertyLinks(links: Partial<PropertyLinks>): string | null {
  for (const key of Object.keys(LINK_LABELS) as (keyof PropertyLinks)[]) {
    const value = (links[key] ?? '').trim();
    if (!value) continue; // 未入力はOK

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return `「${LINK_LABELS[key]}」が正しいURLの形式ではありません。「https://」から始まる形式で入力してください。`;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return `「${LINK_LABELS[key]}」は http:// または https:// で始まるURLを入力してください。`;
    }
  }
  return null;
}
