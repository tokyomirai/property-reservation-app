'use client';

// ③ 社内用内見カレンダー ＋ ⑤ 社内案内予約の登録。
// 社内ログイン必須のAPIのみを叩いており、仲介会社側の画面からは参照できない。

import { useState, useEffect, useCallback } from 'react';

interface PropertyOption {
  id: string;
  name: string;
}

interface CalendarEntry {
  id: string;
  kind: '内見予約' | '社内案内予約';
  propertyId: string;
  propertyName: string;
  date: string;
  startTime: string;
  endTime: string;
  companyName: string;
  personName: string;
  phone: string;
  mobilePhone: string;
  notes: string;
  status: string;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** YYYY-MM-DD を「7/22(水)」形式に整形する。 */
function formatDateLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${Number(m[2])}/${Number(m[3])}（${WEEKDAYS[d.getDay()]}）`;
}

function todayIso(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export default function CalendarTab({ properties }: { properties: PropertyOption[] }) {
  // 読み込み前は null。ローディング表示はこの値から導出する。
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const emptyForm = {
    propertyId: '',
    staffName: '',
    date: todayIso(),
    startTime: '',
    endTime: '',
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar');
      setEntries(res.ok ? await res.json() : []);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/calendar')
      .then((res) => (res.ok ? res.json() : []))
      .catch((err) => {
        console.error('Failed to fetch calendar:', err);
        return [];
      })
      .then((data) => {
        if (!cancelled) setEntries(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (form.endTime <= form.startTime) {
      setError('終了時間は開始時間より後の時刻を指定してください。');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/internal-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // 重複時はサーバーが返す重複内容をそのまま表示する
        setError(data?.error || '社内案内予約の登録に失敗しました。');
        return;
      }
      await refresh();
      setForm(emptyForm);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      setError('社内案内予約の登録に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: CalendarEntry) => {
    if (entry.kind !== '社内案内予約') return;
    if (!confirm(`社内案内予約を削除します。\n\n【${entry.propertyName} / ${entry.personName}（${entry.date} ${entry.startTime}〜${entry.endTime}）】\n\nよろしいですか？`)) return;

    try {
      const res = await fetch(`/api/internal-bookings/${entry.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await refresh();
    } catch (err) {
      console.error(err);
      alert('社内案内予約の削除に失敗しました。');
    }
  };

  if (entries === null) {
    return (
      <div className="bg-white border border-slate-200 rounded-b-xl p-12 text-center shadow-md">
        <p className="text-slate-500 text-sm animate-pulse font-medium">カレンダーを読み込み中...</p>
      </div>
    );
  }

  const today = todayIso();
  const visible = showPast ? entries : entries.filter((e) => e.date >= today);

  // 日付ごとにグループ化して、1日1ブロックで表示する
  const grouped = visible.reduce<Record<string, CalendarEntry[]>>((acc, entry) => {
    (acc[entry.date] ??= []).push(entry);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  return (
    <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-md">
      {/* ツールバー */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <span>🔒</span> 社内用 内見カレンダー
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            内見予約と社内案内予約をまとめて表示します。この画面は社内のみ閲覧可能です。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPast(!showPast)}
            className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-250 text-xs font-bold shadow-sm transition-colors"
          >
            {showPast ? '今日以降のみ表示' : '過去の予定も表示'}
          </button>
          <button
            onClick={() => { setError(''); setIsModalOpen(true); }}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/10 transition-colors"
          >
            ➕ 社内案内予約を登録
          </button>
        </div>
      </div>

      {/* 予定一覧 */}
      {dates.length === 0 ? (
        <div className="px-6 py-16 text-center text-slate-400 text-sm">
          {showPast ? '登録されている予定はありません。' : '今日以降の予定はありません。'}
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {dates.map((date) => (
            <div key={date} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-extrabold text-slate-800">{formatDateLabel(date)}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                  {grouped[date].length}件
                </span>
                {date === today && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">本日</span>
                )}
              </div>

              <div className="space-y-2">
                {grouped[date].map((entry) => {
                  const isInternal = entry.kind === '社内案内予約';
                  return (
                    <div
                      key={`${entry.kind}-${entry.id}`}
                      className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg border px-4 py-3 ${
                        isInternal
                          ? 'bg-violet-50/60 border-violet-200'
                          : entry.status === '承認済'
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-amber-50/60 border-amber-200'
                      }`}
                    >
                      {/* 時間帯 */}
                      <div className="font-mono text-sm font-extrabold text-slate-800 whitespace-nowrap sm:w-32">
                        {entry.startTime && entry.endTime
                          ? `${entry.startTime}〜${entry.endTime}`
                          : '時間未設定'}
                      </div>

                      {/* 区分 */}
                      <div className="shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isInternal
                              ? 'bg-violet-100 text-violet-700 border-violet-250'
                              : entry.status === '承認済'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-250'
                              : 'bg-amber-100 text-amber-700 border-amber-250'
                          }`}
                        >
                          {isInternal ? '社内案内' : `内見・${entry.status}`}
                        </span>
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-sm truncate">{entry.propertyName}</div>
                        <div className="text-xs text-slate-600 mt-0.5 truncate">
                          {isInternal ? `担当：${entry.personName}` : `${entry.companyName} / ${entry.personName} 様`}
                          {entry.phone && <span className="text-slate-500 font-mono ml-2">会社 {entry.phone}</span>}
                          {entry.mobilePhone && <span className="text-slate-500 font-mono ml-2">担当 {entry.mobilePhone}</span>}
                        </div>
                        {entry.notes && (
                          <div className="text-[11px] text-slate-500 mt-1 truncate">📝 {entry.notes}</div>
                        )}
                      </div>

                      {isInternal && (
                        <button
                          onClick={() => handleDelete(entry)}
                          title="この社内案内予約を削除します"
                          className="shrink-0 px-2.5 py-1.5 rounded bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold shadow-sm transition-colors"
                        >
                          🗑 削除
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- モーダル: 社内案内予約の登録 --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">🗓️ 社内案内予約の登録</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  物件 <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  value={form.propertyId}
                  onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
                >
                  <option value="">-- 物件を選択 --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  担当者 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例：山田 太郎"
                  className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  value={form.staffName}
                  onChange={(e) => setForm({ ...form, staffName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    日付 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    開始時間 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    step={900}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    終了時間 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    step={900}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">備考</label>
                <textarea
                  rows={3}
                  placeholder="同行者や案内内容などがあれば入力してください。"
                  className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {/* 重複エラーの表示 */}
              {error && (
                <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold whitespace-pre-wrap leading-relaxed">
                  ⚠️ {error}
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md"
                >
                  {submitting ? '登録中...' : '登録する'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm border border-slate-250"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
