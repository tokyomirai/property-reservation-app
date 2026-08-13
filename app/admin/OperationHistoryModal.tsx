'use client';

// 予約の操作履歴（監査ログ）を時系列で表示するモーダル。社内のみ（/api/operation-logs は要ログイン）。
// 「誰が最初に承認して、その後誰が変更したか」を時系列で確認できる。

import { useState, useEffect } from 'react';

interface OperationLog {
  id: string;
  action: string;
  operatorName: string;
  operatorEmail: string;
  beforeValue: string;
  afterValue: string;
  createdAt: string;
}

/** 操作者の表示名（氏名を優先、なければメール、どちらも無ければ記録なし）。 */
function operatorLabel(log: OperationLog): string {
  return log.operatorName || log.operatorEmail || '記録なし';
}

export default function OperationHistoryModal({
  targetType,
  targetId,
  title,
  onClose,
}: {
  targetType: 'reservation' | 'internalBooking';
  targetId: string;
  title: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<OperationLog[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/operation-logs?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setLogs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setError('操作履歴の取得に失敗しました。');
      });
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-800">🕓 操作履歴</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg font-bold leading-none">
            ×
          </button>
        </div>
        <p className="px-5 pt-3 text-xs text-slate-500 font-medium">{title}</p>

        <div className="p-5">
          {error ? (
            <p className="text-sm text-rose-600 font-semibold">{error}</p>
          ) : logs === null ? (
            <p className="text-sm text-slate-500 animate-pulse">読み込み中...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-slate-500">
              操作履歴の記録はありません（今回の機能追加より前の操作は記録されていません）。
            </p>
          ) : (
            <ol className="space-y-3">
              {logs.map((log) => (
                <li key={log.id} className="border-l-2 border-indigo-200 pl-3">
                  <div className="text-xs text-slate-500 font-mono">
                    {new Date(log.createdAt).toLocaleString('ja-JP')}
                  </div>
                  <div className="text-sm text-slate-800 font-bold">
                    {operatorLabel(log)}　<span className="text-indigo-600">{log.action}</span>
                  </div>
                  {/* 変更前→変更後（日時変更・ステータス変更） */}
                  {log.action !== '登録' && log.action !== '削除' && log.beforeValue && log.afterValue && (
                    <div className="text-xs text-slate-600 mt-0.5">
                      {log.beforeValue} <span className="text-slate-400">→</span> {log.afterValue}
                    </div>
                  )}
                  {log.action === '登録' && log.afterValue && (
                    <div className="text-xs text-slate-600 mt-0.5">{log.afterValue}</div>
                  )}
                  {log.action === '削除' && log.beforeValue && (
                    <div className="text-xs text-slate-600 mt-0.5">{log.beforeValue}</div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
