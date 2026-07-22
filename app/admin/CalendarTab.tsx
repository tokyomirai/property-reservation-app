'use client';

// ③ 社内用内見カレンダー（Googleカレンダー風の月／週／日表示）＋ ⑤ 社内案内予約の登録。
// 社内ログイン必須のAPIのみを叩いており、仲介会社側の画面からは参照できない。

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  CATEGORY_COLORS,
  CATEGORY_ORDER,
  type CalendarEntry,
  type CalendarCategory,
} from './calendarTypes';

// FullCalendar はブラウザAPIに依存するためSSRを無効にして読み込む
const MonthCalendar = dynamic(() => import('./MonthCalendar'), {
  ssr: false,
  loading: () => (
    <div className="p-16 text-center text-slate-500 text-sm animate-pulse font-medium">
      カレンダーを読み込み中...
    </div>
  ),
});

interface PropertyOption {
  id: string;
  name: string;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** YYYY-MM-DD を「7月22日（水）」形式に整形する。 */
function formatDateLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${Number(m[2])}月${Number(m[3])}日（${WEEKDAYS[d.getDay()]}）`;
}

function todayIso(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** 区分バッジ */
function CategoryChip({ category }: { category: CalendarCategory }) {
  const c = CATEGORY_COLORS[category];
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.chip}`}>
      {c.label}
    </span>
  );
}

export default function CalendarTab({ properties }: { properties: PropertyOption[] }) {
  // 読み込み前は null。ローディング表示はこの値から導出する。
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [detail, setDetail] = useState<CalendarEntry | null>(null);
  const [dayList, setDayList] = useState<string | null>(null);
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

  const openNewBooking = (date: string, startTime: string, endTime: string) => {
    setForm({ ...emptyForm, date: date || todayIso(), startTime, endTime });
    setError('');
    setIsModalOpen(true);
  };

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
      setDetail(null);
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

  const dayEntries = dayList ? entries.filter((e) => e.date === dayList) : [];

  return (
    <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-md">
      {/* ツールバー・凡例 */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <span>🔒</span> 社内用 内見カレンダー
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            日付をクリックするとその日の予約一覧、予定をクリックすると詳細を表示します。ドラッグで社内案内予約を登録できます。
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* 色分けの凡例 */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {CATEGORY_ORDER.map((c) => (
              <span key={c} className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_COLORS[c].dot}`} />
                {c}
              </span>
            ))}
          </div>
          <button
            onClick={() => openNewBooking(todayIso(), '', '')}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/10 transition-colors whitespace-nowrap"
          >
            ➕ 社内案内予約を登録
          </button>
        </div>
      </div>

      {/* カレンダー本体 */}
      <MonthCalendar
        entries={entries}
        onSelectEntry={setDetail}
        onSelectDate={setDayList}
        onSelectRange={openNewBooking}
      />

      {/* --- モーダル: その日の予約一覧 --- */}
      {dayList && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDayList(null)}>
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-800">
                🗓️ {formatDateLabel(dayList)} の予約
                <span className="ml-2 text-xs font-bold text-slate-500">{dayEntries.length}件</span>
              </h3>
              <button onClick={() => setDayList(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">
                &times;
              </button>
            </div>

            <div className="p-5 space-y-2 max-h-[65vh] overflow-y-auto">
              {dayEntries.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">この日の予約はありません。</p>
              ) : (
                dayEntries.map((e) => (
                  <button
                    key={`${e.kind}-${e.id}`}
                    onClick={() => { setDetail(e); setDayList(null); }}
                    className="w-full text-left flex items-start gap-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 px-4 py-3 transition-colors"
                  >
                    <span className={`mt-1 w-2.5 h-2.5 rounded-sm shrink-0 ${CATEGORY_COLORS[e.category].dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs font-bold text-slate-700">
                        {e.startTime && e.endTime ? `${e.startTime}〜${e.endTime}` : '時間未設定'}
                      </div>
                      <div className="font-bold text-sm text-slate-800 truncate mt-0.5">{e.propertyName}</div>
                      <div className="text-xs text-slate-600 truncate">
                        {e.companyName}
                        {e.personName && ` / ${e.personName}`}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
              <button
                onClick={() => { openNewBooking(dayList, '', ''); setDayList(null); }}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
              >
                ➕ この日に社内案内予約を登録
              </button>
              <button onClick={() => setDayList(null)} className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs border border-slate-250">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- モーダル: 予約詳細 --- */}
      {detail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start gap-3 shrink-0" style={{ backgroundColor: `${CATEGORY_COLORS[detail.category].bg}0f` }}>
              <div className="min-w-0">
                <CategoryChip category={detail.category} />
                <h3 className="text-base font-extrabold text-slate-900 mt-1.5 break-words">{detail.propertyName}</h3>
                <p className="text-xs text-slate-600 font-mono mt-0.5">
                  {formatDateLabel(detail.date)}{' '}
                  {detail.startTime && detail.endTime ? `${detail.startTime}〜${detail.endTime}` : '時間未設定'}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold shrink-0">
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs sm:text-sm">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 text-slate-400 font-medium w-32 align-top">
                      {detail.kind === '社内案内予約' ? '担当者' : '仲介会社'}
                    </td>
                    <td className="py-2.5 text-slate-800 font-bold">
                      {detail.kind === '社内案内予約' ? detail.personName : detail.companyName}
                    </td>
                  </tr>
                  {detail.kind === '内見予約' && (
                    <tr>
                      <td className="py-2.5 text-slate-400 font-medium align-top">ご担当者名</td>
                      <td className="py-2.5 text-slate-700 font-medium">{detail.personName} 様</td>
                    </tr>
                  )}
                  {detail.kind === '内見予約' && (
                    <>
                      <tr>
                        <td className="py-2.5 text-slate-400 font-medium align-top">会社電話番号</td>
                        <td className="py-2.5">
                          {detail.phone ? (
                            <a href={`tel:${detail.phone.replace(/-/g, '')}`} className="text-slate-800 font-mono font-bold hover:text-indigo-600">
                              {detail.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400">未入力</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-slate-400 font-medium align-top">担当者携帯番号</td>
                        <td className="py-2.5">
                          {detail.mobilePhone ? (
                            <a href={`tel:${detail.mobilePhone.replace(/-/g, '')}`} className="text-slate-800 font-mono font-bold hover:text-indigo-600">
                              {detail.mobilePhone}
                            </a>
                          ) : (
                            <span className="text-slate-400">未入力</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-slate-400 font-medium align-top">メールアドレス</td>
                        <td className="py-2.5">
                          <a href={`mailto:${detail.email}`} className="text-slate-700 font-mono hover:text-indigo-600 break-all">
                            {detail.email}
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-slate-400 font-medium align-top">名刺</td>
                        <td className="py-2.5">
                          {detail.hasCard ? (
                            <a
                              href={`/api/reservations/${detail.id}/card`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition-colors"
                            >
                              💳 {detail.cardFileName} を開く
                            </a>
                          ) : (
                            <span className="text-slate-400">アップロードなし</span>
                          )}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr>
                    <td className="py-2.5 text-slate-400 font-medium align-top">備考</td>
                    <td className="py-2.5 text-slate-600 whitespace-pre-wrap">{detail.notes || 'なし'}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 text-slate-400 font-medium align-top">ステータス</td>
                    <td className="py-2.5 text-slate-700 font-bold">{detail.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3 shrink-0">
              {detail.kind === '社内案内予約' && (
                <button
                  onClick={() => handleDelete(detail)}
                  className="px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200"
                >
                  🗑 削除
                </button>
              )}
              <button onClick={() => setDetail(null)} className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- モーダル: 社内案内予約の登録 --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">🗓️ 社内案内予約の登録</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">
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
