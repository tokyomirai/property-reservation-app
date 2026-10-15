// utils/keybox.ts
// キーボックス番号の正規化と分類。マスタ照合・在庫判定で共通に使う。

import { prisma } from './db';

/** 管理番号を正規化（前後空白除去）。先頭ゼロは保持する（"0925"→"0925"）。 */
export function normalizeKb(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export interface KeyBoxHistoryInput {
  keyBoxNumber: string;
  action: '設置' | '変更' | '解除' | '回収' | '返却';
  propertyId?: string;
  propertyName?: string;
  setupLocation?: string;
  unlockCode?: string;
  operator?: string;
}

/**
 * キーボックス使用履歴を1件記録する（append-only）。失敗しても本体処理は止めない。
 * 番号なし（空・00）は記録しない。当社番号に加え、他社所有（金）の返却なども記録対象とする。
 */
export async function recordKeyBoxHistory(input: KeyBoxHistoryInput): Promise<void> {
  const number = normalizeKb(input.keyBoxNumber);
  if (isNoneNumber(number)) return;
  try {
    await prisma.keyBoxHistory.create({
      data: {
        keyBoxNumber: number,
        action: input.action,
        propertyId: input.propertyId ?? '',
        propertyName: input.propertyName ?? '',
        setupLocation: input.setupLocation ?? '',
        unlockCode: input.unlockCode ?? '',
        operator: input.operator ?? '',
      },
    });
  } catch (err) {
    console.error('Failed to record keybox history:', err);
  }
}

/** 番号なし（"00" もしくは未入力）か。 */
export function isNoneNumber(v: string): boolean {
  const n = normalizeKb(v);
  return n === '' || n === '00';
}

/** 他社所有（金さん所有）か。 */
export function isKinNumber(v: string): boolean {
  return normalizeKb(v) === '金';
}

/** 当社キーボックスとして在庫照合の対象となる番号か（00・金・空を除く）。 */
export function isCompanyKb(v: string): boolean {
  const n = normalizeKb(v);
  return n !== '' && n !== '00' && n !== '金';
}
