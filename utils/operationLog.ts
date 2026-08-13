// utils/operationLog.ts
// 予約操作の監査ログ（OperationLog）を記録する共通処理。
// 操作者はログイン中のGoogleアカウント（セッション）から自動取得する（手入力しない）。
// 記録に失敗しても本体の操作（承認・カレンダー・メール等）は止めない。

import { prisma } from './db';
import type { SessionUser } from './session';

export type OperationTargetType = 'reservation' | 'internalBooking';

export interface OperationLogInput {
  targetType: OperationTargetType;
  targetId: string;
  action: string;
  /** 変更前の内容（表示用テキスト。ステータス名や "2026-08-13 19:00〜20:00" など） */
  beforeValue?: string;
  /** 変更後の内容（表示用テキスト） */
  afterValue?: string;
}

/**
 * 操作ログを1件記録する。operator はセッションから取得。
 * ログ保存の失敗は握りつぶす（本体処理を止めないため）。
 */
export async function recordOperationLog(
  operator: SessionUser | null,
  input: OperationLogInput
): Promise<void> {
  try {
    await prisma.operationLog.create({
      data: {
        targetType: input.targetType,
        targetId: input.targetId,
        action: input.action,
        operatorName: operator?.name ?? '',
        operatorEmail: operator?.email ?? '',
        beforeValue: input.beforeValue ?? '',
        afterValue: input.afterValue ?? '',
      },
    });
  } catch (err) {
    console.error('Failed to record operation log:', err);
  }
}

/**
 * 最終処理者フィールド（processedByName / processedByEmail / processedAt）の更新用データ。
 * 予約・手動予約の update に spread して使う。
 */
export function processedByFields(operator: SessionUser | null) {
  return {
    processedByName: operator?.name ?? '',
    processedByEmail: operator?.email ?? '',
    processedAt: new Date(),
  };
}

/** ステータス値から操作ラベルへ変換（内見予約）。 */
export function reservationActionLabel(status: string): string {
  switch (status) {
    case '承認済':
      return '承認';
    case '却下':
      return '却下';
    case 'キャンセル':
      return 'キャンセル';
    case '日時変更':
      return '日時変更';
    case '未承認':
      return '差戻し';
    default:
      return status;
  }
}
