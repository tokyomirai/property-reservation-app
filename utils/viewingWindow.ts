// utils/viewingWindow.ts
// 物件の「内見受付開始日」に関する正規化・判定・表示ユーティリティ。
// 受付開始日が未設定(NULL/空)の場合は日付制限なし＝従来どおりの予約ルールとする。
// クライアント／サーバーの双方で同じ判定を使い、表示とバリデーションを一致させる。

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 受付開始日を正規化する。"YYYY-MM-DD" 形式でなければ空文字（＝未設定）を返す。 */
export function normalizeViewingStartDate(value: string | null | undefined): string {
  const s = (value ?? '').trim();
  return DATE_RE.test(s) ? s : '';
}

/**
 * 希望日が受付開始日より前か。
 * 受付開始日が未設定、または日付が不正な場合は false（＝制限なし）。
 * ISOの日付文字列は辞書順比較でそのまま日付順になる。
 */
export function isBeforeViewingStart(
  preferredDate: string,
  viewingStartDate: string | null | undefined
): boolean {
  const start = normalizeViewingStartDate(viewingStartDate);
  const d = (preferredDate ?? '').trim();
  if (!start || !DATE_RE.test(d)) return false;
  return d < start;
}

/** "2026-08-21" → "8月21日（金）"。表示用（曜日つき）。 */
export function formatViewingDateJp(date: string | null | undefined): string {
  const s = (date ?? '').trim();
  const m = DATE_RE.exec(s);
  if (!m) return s;
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(5, 7));
  const da = Number(s.slice(8, 10));
  const dow = WEEKDAYS[new Date(y, mo - 1, da).getDay()];
  return `${mo}月${da}日（${dow}）`;
}

/** "2026-08-21" → "8月21日"。エラー文言・確認ダイアログ用（曜日なし）。 */
export function formatViewingMonthDayJp(date: string | null | undefined): string {
  const s = (date ?? '').trim();
  const m = DATE_RE.exec(s);
  if (!m) return s;
  return `${Number(s.slice(5, 7))}月${Number(s.slice(8, 10))}日`;
}

/** "2026-08-21" → "8/21"。一覧の省スペース表示用。 */
export function formatViewingSlash(date: string | null | undefined): string {
  const s = (date ?? '').trim();
  const m = DATE_RE.exec(s);
  if (!m) return s;
  return `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
}

/** サーバー側の予約拒否メッセージ。「この物件は8月21日以降、内見可能です。」 */
export function viewingStartErrorMessage(viewingStartDate: string | null | undefined): string {
  return `この物件は${formatViewingMonthDayJp(viewingStartDate)}以降、内見可能です。`;
}
