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
import PropertyCombobox from './PropertyCombobox';

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
  address: string;
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

  // 内見予約の日時変更フォーム（詳細モーダル or ドラッグから開く）
  const [reschedule, setReschedule] = useState<
    { entry: CalendarEntry; date: string; startTime: string; endTime: string } | null
  >(null);
  const [rescheduleError, setRescheduleError] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar');
      setEntries(res.ok ? await res.json() : []);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
      setEntries([]);
    }
  }, []);

  /** 内見予約・社内案内予約の日時変更を適用（フォーム保存・ドラッグ共通）。成否とエラーメッセージを返す。 */
  const applyReschedule = useCallback(
    async (
      entry: CalendarEntry,
      date: string,
      startTime: string,
      endTime: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        // 予約種別ごとにエンドポイントとキー名（内見=preferredDate / 社内案内=date）を切り替える
        const url =
          entry.kind === '社内案内予約'
            ? `/api/internal-bookings/${entry.id}`
            : `/api/reservations/${entry.id}`;
        const reschedule =
          entry.kind === '社内案内予約'
            ? { date, startTime, endTime }
            : { preferredDate: date, startTime, endTime };
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reschedule }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { ok: false, error: data?.error || '日時変更に失敗しました。' };
        await refresh();
        return { ok: true };
      } catch (err) {
        console.error(err);
        return { ok: false, error: '日時変更に失敗しました。' };
      }
    },
    [refresh]
  );

  /** ステータス変更（キャンセル／却下）。 */
  const handleStatusChange = useCallback(
    async (entry: CalendarEntry, status: 'キャンセル' | '却下', label: string) => {
      if (entry.kind !== '内見予約') return;
      if (!confirm(`この内見予約を「${label}」にします。\n\n【${entry.propertyName} / ${entry.companyName}（${entry.date} ${entry.startTime}〜${entry.endTime}）】\n\n履歴は残ります。よろしいですか？`)) return;
      setStatusBusy(true);
      try {
        const res = await fetch(`/api/reservations/${entry.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          alert(data?.error || 'ステータスの更新に失敗しました。');
          return;
        }
        await refresh();
        setDetail(null);
      } finally {
        setStatusBusy(false);
      }
    },
    [refresh]
  );

  /** カレンダー上のドラッグ／リサイズによる日時変更。内見予約・社内案内予約が対象。失敗時は false を返し元に戻す。 */
  const handleCalendarReschedule = useCallback(
    async (entry: CalendarEntry, date: string, startTime: string, endTime: string): Promise<boolean> => {
      const r = await applyReschedule(entry, date, startTime, endTime);
      if (!r.ok) alert(r.error || '日時変更に失敗しました。');
      return r.ok;
    },
    [applyReschedule]
  );

  /** 社内案内予約のキャンセル（ステータスをキャンセルに。履歴は残す）。 */
  const handleCancelInternal = useCallback(
    async (entry: CalendarEntry) => {
      if (entry.kind !== '社内案内予約') return;
      if (!confirm(`この社内案内をキャンセルしますか？\n\n【${entry.propertyName} / ${entry.personName}（${entry.date} ${entry.startTime}〜${entry.endTime}）】\n\n履歴は残ります。`)) return;
      setStatusBusy(true);
      try {
        const res = await fetch(`/api/internal-bookings/${entry.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'キャンセル' }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          alert(data?.error || 'キャンセルに失敗しました。');
          return;
        }
        await refresh();
        setDetail(null);
      } finally {
        setStatusBusy(false);
      }
    },
    [refresh]
  );

  /** 日時変更フォームを開く。 */
  const openReschedule = (entry: CalendarEntry) => {
    setReschedule({ entry, date: entry.date, startTime: entry.startTime, endTime: entry.endTime });
    setRescheduleError('');
    setDetail(null);
  };

  /** 日時変更フォームの保存。 */
  const submitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedule || statusBusy) return;
    if (!reschedule.startTime || !reschedule.endTime) {
      setRescheduleError('開始時間と終了時間を入力してください。');
      return;
    }
    if (reschedule.endTime <= reschedule.startTime) {
      setRescheduleError('終了時間は開始時間より後の時刻を指定してください。');
      return;
    }
    setStatusBusy(true);
    const r = await applyReschedule(reschedule.entry, reschedule.date, reschedule.startTime, reschedule.endTime);
    setStatusBusy(false);
    if (!r.ok) {
      setRescheduleError(r.error || '日時変更に失敗しました。');
      return;
    }
    setReschedule(null);
  };

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

    if (!form.propertyId) {
      setError('物件を選択してください。');
      return;
    }
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
        onReschedule={handleCalendarReschedule}
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

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-2 shrink-0">
              {/* 社内案内予約の運用操作：日時変更／キャンセル／削除（削除は完全削除の別機能） */}
              {detail.kind === '社内案内予約' && (
                <>
                  {detail.status !== 'キャンセル' && (
                    <>
                      <button
                        onClick={() => openReschedule(detail)}
                        disabled={statusBusy}
                        className="px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 disabled:opacity-50"
                      >
                        🕒 日時変更
                      </button>
                      <button
                        onClick={() => handleCancelInternal(detail)}
                        disabled={statusBusy}
                        className="px-4 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs border border-amber-200 disabled:opacity-50"
                      >
                        🚫 キャンセル
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(detail)}
                    disabled={statusBusy}
                    className="px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 disabled:opacity-50"
                  >
                    🗑 削除
                  </button>
                </>
              )}
              {/* 内見予約の運用操作（アクティブな予約のみ）。キャンセル／却下済みは操作を出さない。 */}
              {detail.kind === '内見予約' && ['未承認', '承認済', '日時変更'].includes(detail.status) && (
                <>
                  <button
                    onClick={() => openReschedule(detail)}
                    disabled={statusBusy}
                    className="px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 disabled:opacity-50"
                  >
                    🕒 日時変更
                  </button>
                  <button
                    onClick={() => handleStatusChange(detail, 'キャンセル', 'キャンセル')}
                    disabled={statusBusy}
                    className="px-4 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs border border-amber-200 disabled:opacity-50"
                  >
                    🚫 キャンセル
                  </button>
                  <button
                    onClick={() => handleStatusChange(detail, '却下', '却下')}
                    disabled={statusBusy}
                    className="px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 disabled:opacity-50"
                  >
                    ⛔ 却下
                  </button>
                </>
              )}
              <button onClick={() => setDetail(null)} className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- モーダル: 内見予約の日時変更 --- */}
      {reschedule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !statusBusy && setReschedule(null)}>
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-800">🕒 {reschedule.entry.kind === '社内案内予約' ? '社内案内の日時変更' : '内見予約の日時変更'}</h3>
              <button onClick={() => !statusBusy && setReschedule(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">
                &times;
              </button>
            </div>

            <form onSubmit={submitReschedule} className="p-6 space-y-4">
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="font-bold text-slate-800 break-words">{reschedule.entry.propertyName}</div>
                <div className="mt-0.5">{reschedule.entry.companyName} / {reschedule.entry.personName} 様</div>
                <div className="mt-0.5 text-slate-400">
                  変更前: {reschedule.entry.date} {reschedule.entry.startTime}〜{reschedule.entry.endTime}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">日付 <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={reschedule.date}
                    onChange={(e) => setReschedule({ ...reschedule, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">開始 <span className="text-rose-500">*</span></label>
                  <input
                    type="time"
                    required
                    step={900}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={reschedule.startTime}
                    onChange={(e) => setReschedule({ ...reschedule, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">終了 <span className="text-rose-500">*</span></label>
                  <input
                    type="time"
                    required
                    step={900}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={reschedule.endTime}
                    onChange={(e) => setReschedule({ ...reschedule, endTime: e.target.value })}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                {reschedule.entry.kind === '社内案内予約'
                  ? '保存するとDB・社内カレンダー・一覧が更新されます。'
                  : '保存するとDB・社内カレンダー・予約情報が更新され、ステータスは「日時変更」になります。'}
              </p>

              {rescheduleError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold whitespace-pre-wrap leading-relaxed">
                  ⚠️ {rescheduleError}
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={statusBusy}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md"
                >
                  {statusBusy ? '保存中...' : '保存する'}
                </button>
                <button
                  type="button"
                  onClick={() => setReschedule(null)}
                  disabled={statusBusy}
                  className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm border border-slate-250 disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
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
                {/* 検索付きコンボボックス：物件名・住所の部分一致で候補を絞り込む */}
                <PropertyCombobox
                  options={properties}
                  value={form.propertyId}
                  onChange={(id) => setForm({ ...form, propertyId: id })}
                  placeholder="物件名・住所で検索"
                />
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
