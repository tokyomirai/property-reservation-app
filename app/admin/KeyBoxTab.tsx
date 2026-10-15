'use client';

// キーボックス在庫タブ。
// 社内KB番号マスタと物件の管理番号を照合し、各番号が今どこにあるか（社内在庫/物件使用中/
// 重複使用/未登録番号）を一覧表示する。現地確認・棚卸履歴は扱わず、既存データを参照するのみ。

import { useState, useEffect, useCallback, useRef } from 'react';

interface AssignedProperty {
  id: string;
  name: string;
  address: string;
  setupLocation: string;
  unlockCode: string;
  hasSlippers: string;
  notes: string;
  lastUpdatedBy: string;
  updatedAt: string;
}
type KbState = '社内在庫' | '物件使用中' | '重複使用' | '未登録番号' | '回収待ち';
interface KbRow {
  number: string;
  state: KbState;
  inMaster: boolean;
  isActive: boolean;
  kbNotes: string;
  storageLocation: string;
  properties: AssignedProperty[];
  warning?: string;
}
interface Aggregates {
  total: number; inStock: number; inUse: number; duplicate: number;
  pending: number;
  unregistered: number; none00: number; kin: number;
}
interface Recovery {
  id: string; itemType: string; keyBoxNumber: string; propertyName: string; propertyAddress: string;
  setupLocation: string; unlockCode: string; status: string;
  requestedBy: string; requestedAt: string; recoveredBy: string; recoveredAt: string | null;
  recoveredLocation?: string;
}
interface KbHistory {
  id: string; keyBoxNumber: string; action: string; propertyName: string;
  setupLocation: string; unlockCode: string; operator: string; createdAt: string;
}
interface Excluded {
  none00: { name: string; address: string }[];
  kin: { name: string; address: string }[];
}
interface KeyBox {
  id: string; number: string; notes: string; isActive: boolean; storageLocation?: string;
}

// 共通の状態は白/薄グレーで落ち着かせ、重要（回収待ち）・警告（重複/未登録）のみ色で強調する。
const STATE_STYLE: Record<KbState, string> = {
  物件使用中: 'bg-slate-100 text-slate-700 border-slate-200',
  社内在庫: 'bg-slate-50 text-slate-600 border-slate-200',
  回収待ち: 'bg-amber-50 text-amber-800 border-amber-300',
  重複使用: 'bg-rose-50 text-rose-700 border-rose-200',
  未登録番号: 'bg-orange-100 text-orange-800 border-orange-300',
};

type FilterKey = 'すべて' | '社内在庫' | '物件使用中' | '重複使用';

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 保管場所の選択モーダル（4F初期／その他は自由入力）。回収完了・在庫場所変更で共用。 */
function LocationModal({
  title, current, busy, onSubmit, onClose,
}: {
  title: string; current: string; busy: boolean;
  onSubmit: (loc: string) => void; onClose: () => void;
}) {
  const [choice, setChoice] = useState<'4F' | 'その他'>(current && current !== '4F' ? 'その他' : '4F');
  const [text, setText] = useState(current && current !== '4F' ? current : '');
  const value = choice === '4F' ? '4F' : text.trim();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800">📦 {title}</h3>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">社内のどこに保管しますか？（通常は 4F）</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setChoice('4F')}
              className={`flex-1 h-10 rounded-lg text-sm font-bold border transition-colors ${choice === '4F' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-250 hover:bg-slate-50'}`}>
              4F
            </button>
            <button type="button" onClick={() => setChoice('その他')}
              className={`flex-1 h-10 rounded-lg text-sm font-bold border transition-colors ${choice === 'その他' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-250 hover:bg-slate-50'}`}>
              その他
            </button>
          </div>
          {choice === 'その他' && (
            <input
              type="text" autoFocus placeholder="保管場所を入力（例：2F書庫）"
              className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
              value={text} onChange={(e) => setText(e.target.value)}
            />
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={() => !busy && onClose()} className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-250 text-xs font-bold">キャンセル</button>
          <button onClick={() => onSubmit(value)} disabled={busy || (choice === 'その他' && !value)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? '処理中...' : '確定'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 集計タイル。 */
function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${tone}`}>
      <div className="text-[11px] font-bold opacity-80">{label}</div>
      <div className="text-xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

export default function KeyBoxTab() {
  const [rows, setRows] = useState<KbRow[] | null>(null);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [excluded, setExcluded] = useState<Excluded | null>(null);
  const [master, setMaster] = useState<KeyBox[]>([]);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [recoveryBusy, setRecoveryBusy] = useState<string | null>(null);
  // 回収履歴（回収済み）。開いた時に取得する。
  const [history, setHistory] = useState<Recovery[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/keyboxes/recoveries?status=回収済み');
      setHistory(r.ok ? await r.json() : []);
    } catch { setHistory([]); }
  }, []);
  // キーボックス番号ごとの使用履歴（設置・変更・解除・回収）モーダル
  const [numHistory, setNumHistory] = useState<{ number: string; rows: KbHistory[] | null } | null>(null);
  const openNumberHistory = async (number: string) => {
    setNumHistory({ number, rows: null });
    try {
      const r = await fetch(`/api/keyboxes/history?number=${encodeURIComponent(number)}`);
      setNumHistory({ number, rows: r.ok ? await r.json() : [] });
    } catch { setNumHistory({ number, rows: [] }); }
  };
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('すべて');
  const [showExcluded, setShowExcluded] = useState(false);
  const [isMasterOpen, setIsMasterOpen] = useState(false);
  // 一覧だけを内部スクロールさせる領域の高さ（固定部の実測から算出）
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableMaxH, setTableMaxH] = useState(360);
  // 保管場所モーダル（回収完了時／社内在庫の場所変更時に共用）
  const [locModal, setLocModal] = useState<
    | { mode: 'recover'; rec: Recovery }
    | { mode: 'edit'; kbId: string; number: string; current: string }
    | null
  >(null);

  const refresh = useCallback(async () => {
    try {
      const [invRes, masterRes, recRes] = await Promise.all([
        fetch('/api/keyboxes/inventory'),
        fetch('/api/keyboxes'),
        fetch('/api/keyboxes/recoveries?status=回収待ち'),
      ]);
      if (invRes.ok) {
        const inv = await invRes.json();
        setRows(inv.rows);
        setAggregates(inv.aggregates);
        setExcluded(inv.excluded);
      } else {
        setRows([]);
      }
      if (masterRes.ok) setMaster(await masterRes.json());
      if (recRes.ok) setRecoveries(await recRes.json());
    } catch (err) {
      console.error('Failed to fetch keybox inventory:', err);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/keyboxes/inventory').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/keyboxes').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/keyboxes/recoveries?status=回収待ち').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([inv, m, rec]) => {
        if (cancelled) return;
        if (inv) { setRows(inv.rows); setAggregates(inv.aggregates); setExcluded(inv.excluded); }
        else setRows([]);
        setMaster(m);
        setRecoveries(rec);
      })
      .catch((err) => { console.error(err); if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, []);

  // 一覧テーブルの内部スクロール高さ＝「ビューポート高 - テーブル上端 - 余白」。固定部はスクロールさせない。
  useEffect(() => {
    const update = () => {
      const el = tableScrollRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setTableMaxH(Math.max(220, window.innerHeight - top - 24));
    };
    update();
    const ro = new ResizeObserver(update);
    if (tableScrollRef.current) ro.observe(tableScrollRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update); };
  }, [rows, recoveries, aggregates]);

  // 備品種別のラベル（🔑 №5 / 🥿 スリッパ / 🪧 売り看板）
  const recoveryItemLabel = (rec: Recovery) =>
    rec.itemType === 'キーボックス' ? `🔑 キーボックス №${rec.keyBoxNumber}`
    : rec.itemType === 'スリッパ' ? '🥿 スリッパ'
    : rec.itemType === '売り看板' ? '🪧 売り看板'
    : rec.itemType;

  // 回収完了。キーボックスは保管場所の選択（4F初期）を挟んで社内在庫へ戻す。それ以外は即完了。
  const completeRecovery = async (rec: Recovery) => {
    if (recoveryBusy) return;
    if (rec.itemType === 'キーボックス') { setLocModal({ mode: 'recover', rec }); return; }
    if (!confirm(`${recoveryItemLabel(rec)}（${rec.propertyName}）を回収完了にします。よろしいですか？`)) return;
    setRecoveryBusy(rec.id);
    try {
      const res = await fetch(`/api/keyboxes/recoveries/${rec.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      if (!res.ok) { alert('回収完了の登録に失敗しました。'); return; }
      await refresh();
    } finally { setRecoveryBusy(null); }
  };

  // 保管場所モーダルの確定（回収完了＝recover / 在庫の場所変更＝edit）
  const submitLocation = async (location: string) => {
    if (!locModal) return;
    if (locModal.mode === 'recover') {
      setRecoveryBusy(locModal.rec.id);
      try {
        const res = await fetch(`/api/keyboxes/recoveries/${locModal.rec.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'complete', storageLocation: location }),
        });
        if (!res.ok) { alert('回収完了の登録に失敗しました。'); return; }
        setLocModal(null);
        await refresh();
      } finally { setRecoveryBusy(null); }
    } else {
      const m = master.find((x) => x.id === locModal.kbId);
      if (!m) { setLocModal(null); return; }
      const res = await fetch(`/api/keyboxes/${locModal.kbId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: m.number, notes: m.notes, isActive: m.isActive, storageLocation: location }),
      });
      if (!res.ok) { alert('保管場所の更新に失敗しました。'); return; }
      setLocModal(null);
      await refresh();
    }
  };

  if (rows === null) {
    return (
      <div className="bg-white border border-slate-200 rounded-b-xl p-12 text-center shadow-md">
        <p className="text-slate-500 text-sm animate-pulse font-medium">在庫を読み込み中...</p>
      </div>
    );
  }

  // 検索・絞り込み
  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (filter !== 'すべて' && r.state !== filter) return false;
    if (!q) return true;
    const hay = [
      r.number,
      ...r.properties.flatMap((p) => [p.name, p.address, p.setupLocation]),
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
  // 未登録番号は「すべて」表示のとき末尾に含める（警告として気づけるように）
  const unregisteredVisible = visible.filter((r) => r.state === '未登録番号');
  const normalVisible = visible.filter((r) => r.state !== '未登録番号');

  return (
    <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-md">
      {/* ヘッダ */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <span>🔑</span> キーボックス在庫（番号照合）
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            社内KB番号マスタと物件の管理番号を照合し、各番号が今どこに割り当てられているかを表示します（現地確認は不要）。
          </p>
        </div>
        <button
          onClick={() => setIsMasterOpen(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/10 transition-colors whitespace-nowrap"
        >
          🔧 KB番号マスタ管理
        </button>
      </div>

      {/* 集計 */}
      {aggregates && (
        <div className="px-5 py-4 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {/* 既定は白/薄グレー。重要な「回収待ち」「重複使用」は件数がある時のみ色で強調する。 */}
          <Stat label="当社KB総数" value={aggregates.total} tone="bg-white text-slate-800 border-slate-200" />
          <Stat label="社内在庫" value={aggregates.inStock} tone="bg-white text-slate-800 border-slate-200" />
          <Stat label="物件使用中" value={aggregates.inUse} tone="bg-white text-slate-800 border-slate-200" />
          <Stat label="回収待ち" value={aggregates.pending ?? 0} tone={(aggregates.pending ?? 0) > 0 ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-slate-50 text-slate-400 border-slate-200'} />
          <Stat label="重複使用" value={aggregates.duplicate} tone={aggregates.duplicate > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-400 border-slate-200'} />
          <Stat label="番号なし(00)" value={aggregates.none00} tone="bg-slate-50 text-slate-400 border-slate-200" />
          <Stat label="他社所有(金)" value={aggregates.kin} tone="bg-slate-50 text-slate-400 border-slate-200" />
        </div>
      )}

      {/* 回収待ち（未回収）一覧：売却済みにした際に未回収としたキーボックス。回収完了まで社内在庫に戻さない。 */}
      {recoveries.length > 0 && (
        <div className="mx-5 mt-4 rounded-lg border border-amber-300 bg-amber-50/60 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-200 flex items-center gap-2">
            <span className="text-sm font-bold text-amber-800">🔁 回収待ち（未回収）</span>
            <span className="text-[11px] font-bold text-white bg-amber-600 rounded-full px-2 py-0.5">{recoveries.length}件</span>
            <span className="text-[11px] text-amber-700 ml-auto">回収したら「回収完了」を押すと社内在庫に戻ります</span>
          </div>
          <div className="divide-y divide-amber-100 max-h-[200px] overflow-y-auto">
            {recoveries.map((rec) => (
              <div key={rec.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-bold text-slate-800 w-40 shrink-0">{recoveryItemLabel(rec)}</span>
                <div className="min-w-[160px] flex-1">
                  <div className="font-bold text-slate-800">{rec.propertyName}</div>
                  <div className="text-[11px] text-slate-500">
                    📍 {rec.propertyAddress || '—'}
                    {rec.itemType === 'キーボックス' && <>　保管：{rec.setupLocation || '—'}　解除：{rec.unlockCode || '—'}</>}
                  </div>
                </div>
                <span className="text-[11px] text-slate-500">
                  登録：{rec.requestedBy || '—'}<br />{fmtDate(rec.requestedAt)}
                </span>
                <button
                  onClick={() => completeRecovery(rec)}
                  disabled={recoveryBusy === rec.id}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm"
                >
                  {recoveryBusy === rec.id ? '処理中...' : '✓ 回収完了'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 回収履歴（回収済み）：いつ・誰が・どこへ戻したかを確認できる */}
      <div className="px-5 pt-4">
        <button
          onClick={() => { const n = !showHistory; setShowHistory(n); if (n && history === null) loadHistory(); }}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
        >
          {showHistory ? '▼' : '▶'} 🗂 回収履歴（戻し先の記録）
        </button>
        {showHistory && (
          <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
            {history === null ? (
              <div className="px-4 py-3 text-xs text-slate-400">読み込み中...</div>
            ) : history.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400">回収済みの履歴はまだありません。</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                    <span className="font-bold text-slate-800 w-40 shrink-0">{recoveryItemLabel(h)}</span>
                    <div className="min-w-[140px] flex-1">
                      <div className="text-slate-700">{h.propertyName}</div>
                      <div className="text-[11px] text-slate-500">📍 {h.propertyAddress || '—'}</div>
                    </div>
                    {h.itemType === 'キーボックス' && (
                      <span className="text-xs font-bold text-sky-700 whitespace-nowrap">戻し先：{h.recoveredLocation || '—'}</span>
                    )}
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      回収：{h.recoveredBy || '—'}<br />{h.recoveredAt ? fmtDate(h.recoveredAt) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 未登録番号の警告バナー */}
      {aggregates && aggregates.unregistered > 0 && (
        <div className="mx-5 mt-4 p-3 rounded-lg bg-orange-50 border border-orange-300 text-orange-800 text-xs font-bold">
          ⚠️ マスタに未登録（または廃止済み）のキーボックス番号が物件に登録されています：{aggregates.unregistered}件（下の一覧に表示）
        </div>
      )}

      {/* 検索・絞り込み */}
      <div className="px-5 py-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          placeholder="KB番号・物件名・保管場所で検索"
          className="flex-1 bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          {(['すべて', '社内在庫', '物件使用中', '重複使用'] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 一覧（この領域だけ縦スクロール。ヘッダーは sticky で固定） */}
      <div ref={tableScrollRef} className="overflow-auto border-t border-slate-200" style={{ maxHeight: tableMaxH }}>
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-slate-505 text-xs font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm [&>tr>th]:bg-slate-50">
            <tr>
              <th className="px-5 py-3">KB番号</th>
              <th className="px-4 py-3">状態</th>
              <th className="px-4 py-3">物件名 / 住所</th>
              <th className="px-4 py-3">保管場所</th>
              <th className="px-4 py-3">解除番号</th>
              <th className="px-4 py-3">スリッパ</th>
              <th className="px-4 py-3">最終更新</th>
              <th className="px-4 py-3">備考</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {[...normalVisible, ...unregisteredVisible].length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  該当するキーボックスがありません。
                </td>
              </tr>
            ) : (
              [...normalVisible, ...unregisteredVisible].map((r) => {
                const dup = r.properties.length > 1;
                return (
                  <tr key={r.number} className={dup || r.state === '未登録番号' ? 'bg-rose-500/[0.03]' : 'hover:bg-slate-50/50'}>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-extrabold text-slate-800">№{r.number}</span>
                        <button
                          onClick={() => openNumberHistory(r.number)}
                          title="このキーボックスの使用履歴"
                          className="text-[10px] px-1.5 py-0.5 rounded border border-slate-250 text-slate-500 hover:bg-slate-100 font-bold"
                        >
                          🕓履歴
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${STATE_STYLE[r.state]}`}>
                        {r.state}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {r.properties.length === 0 ? (
                        <span className="text-slate-400">（割当なし）</span>
                      ) : (
                        <div className="space-y-1.5">
                          {r.properties.map((p) => (
                            <div key={p.id}>
                              <div className="font-bold text-slate-800">{p.name}</div>
                              <div className="text-xs text-slate-500">📍 {p.address}</div>
                            </div>
                          ))}
                          {r.warning && (
                            <div className="text-[11px] font-bold text-rose-600 mt-1">⚠️ {r.warning}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {r.state === '社内在庫' ? (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className={r.storageLocation ? 'font-bold text-sky-700' : 'text-amber-700 font-bold'}>
                            {r.storageLocation || '未設定'}
                          </span>
                          {r.inMaster && (
                            <button
                              onClick={() => { const m = master.find((x) => x.number === r.number); if (m) setLocModal({ mode: 'edit', kbId: m.id, number: r.number, current: r.storageLocation }); }}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-slate-250 text-slate-500 hover:bg-slate-100 font-bold"
                            >
                              変更
                            </button>
                          )}
                        </div>
                      ) : r.properties.length > 0 ? (
                        r.properties.map((p, i) => (
                          <div key={i} className="min-h-[1.25rem]">{p.setupLocation || '—'}</div>
                        ))
                      ) : '—'}
                    </td>
                    <td className="px-4 py-4 font-mono text-slate-700">
                      {r.properties.map((p, i) => (
                        <div key={i} className="min-h-[1.25rem]">{p.unlockCode || '—'}</div>
                      ))}
                      {r.properties.length === 0 && '—'}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {r.properties.map((p, i) => (
                        <div key={i} className="min-h-[1.25rem]">{p.hasSlippers || '—'}</div>
                      ))}
                      {r.properties.length === 0 && '—'}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {r.properties.map((p, i) => (
                        <div key={i} className="min-h-[1.25rem]">
                          {p.lastUpdatedBy || '—'}<br />
                          <span className="text-slate-400">{fmtDate(p.updatedAt)}</span>
                        </div>
                      ))}
                      {r.properties.length === 0 && '—'}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500 max-w-[200px]">
                      {/* 使用中は物件備考、社内在庫はマスタ備考 */}
                      {r.properties.length > 0
                        ? r.properties.map((p, i) => <div key={i} className="truncate">{p.notes || '—'}</div>)
                        : (r.kbNotes || '—')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 対象外（00・金）一覧 */}
      {excluded && (aggregates?.none00 || aggregates?.kin) ? (
        <div className="px-5 py-4 border-t border-slate-200">
          <button
            onClick={() => setShowExcluded(!showExcluded)}
            className="text-xs font-bold text-slate-500 hover:text-slate-700"
          >
            {showExcluded ? '▼' : '▶'} 在庫照合の対象外（番号なし00：{aggregates?.none00 ?? 0}件 / 他社所有金：{aggregates?.kin ?? 0}件）
          </button>
          {showExcluded && (
            <div className="mt-3 grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-1">番号なし（00）</div>
                <div className="space-y-1">
                  {excluded.none00.length === 0 ? <div className="text-xs text-slate-400">なし</div> :
                    excluded.none00.map((p, i) => (
                      <div key={i} className="text-xs text-slate-600">・{p.name}<span className="text-slate-400">（{p.address}）</span></div>
                    ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-1">他社所有（金）</div>
                <div className="space-y-1">
                  {excluded.kin.length === 0 ? <div className="text-xs text-slate-400">なし</div> :
                    excluded.kin.map((p, i) => (
                      <div key={i} className="text-xs text-slate-600">・{p.name}<span className="text-slate-400">（{p.address}）</span></div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {isMasterOpen && (
        <KeyBoxMasterModal master={master} onClose={() => setIsMasterOpen(false)} onChanged={refresh} />
      )}

      {/* キーボックス番号ごとの使用履歴モーダル */}
      {numHistory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setNumHistory(null)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">🕓 キーボックス №{numHistory.number} 使用履歴</h3>
              <button onClick={() => setNumHistory(null)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">×</button>
            </div>
            <div className="p-4 overflow-y-auto">
              {numHistory.rows === null ? (
                <p className="text-sm text-slate-400 animate-pulse">読み込み中...</p>
              ) : numHistory.rows.length === 0 ? (
                <p className="text-sm text-slate-400">この番号の履歴はまだありません（今後の設置・変更・回収から記録されます）。</p>
              ) : (
                <ol className="space-y-2">
                  {numHistory.rows.map((h) => (
                    <li key={h.id} className="border-l-2 border-indigo-200 pl-3 py-0.5">
                      <div className="text-[11px] text-slate-500 font-mono">{new Date(h.createdAt).toLocaleString('ja-JP')}</div>
                      <div className="text-sm">
                        <span className={`font-bold ${h.action === '回収' ? 'text-emerald-700' : h.action === '解除' ? 'text-slate-500' : 'text-indigo-700'}`}>{h.action}</span>
                        <span className="text-slate-700">　{h.propertyName || '—'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {h.setupLocation && <>場所：{h.setupLocation}　</>}解除：{h.unlockCode || '—'}　担当：{h.operator || '—'}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 保管場所モーダル（回収完了／在庫の場所変更で共用） */}
      {locModal && (
        <LocationModal
          title={locModal.mode === 'recover' ? `キーボックス №${locModal.rec.keyBoxNumber} を回収して社内在庫へ` : `キーボックス №${locModal.number} の保管場所を変更`}
          current={locModal.mode === 'edit' ? locModal.current : '4F'}
          busy={locModal.mode === 'recover' ? recoveryBusy === locModal.rec.id : false}
          onSubmit={submitLocation}
          onClose={() => setLocModal(null)}
        />
      )}
    </div>
  );
}

// ── KB番号マスタ管理モーダル ──
function KeyBoxMasterModal({
  master, onClose, onChanged,
}: {
  master: KeyBox[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [list, setList] = useState<KeyBox[]>(master);
  const [number, setNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch('/api/keyboxes');
    if (res.ok) setList(await res.json());
    onChanged();
  }, [onChanged]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/keyboxes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, notes, isActive: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error || '登録に失敗しました。'); return; }
      setNumber(''); setNotes('');
      await reload();
    } finally { setBusy(false); }
  };

  const toggleActive = async (k: KeyBox) => {
    await fetch(`/api/keyboxes/${k.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: k.number, notes: k.notes, isActive: !k.isActive }),
    });
    await reload();
  };

  const remove = async (k: KeyBox) => {
    if (!confirm(`KB番号「${k.number}」をマスタから削除します。よろしいですか？`)) return;
    await fetch(`/api/keyboxes/${k.id}`, { method: 'DELETE' });
    await reload();
  };

  // 一括追加（改行/カンマ区切り）
  const [bulk, setBulk] = useState('');
  const addBulk = async () => {
    if (busy) return;
    const nums = bulk.split(/[\s,、]+/).map((s) => s.trim()).filter(Boolean);
    if (nums.length === 0) return;
    setBusy(true); setError('');
    let okCount = 0; const errs: string[] = [];
    for (const n of nums) {
      const res = await fetch('/api/keyboxes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: n, notes: '', isActive: true }),
      });
      if (res.ok) okCount++;
      else { const d = await res.json().catch(() => null); errs.push(`${n}: ${d?.error || 'エラー'}`); }
    }
    setBulk('');
    setError(errs.length ? `${okCount}件追加。スキップ: ${errs.join(' / ')}` : '');
    await reload();
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-slate-800">🔧 KB番号マスタ管理</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* 追加フォーム */}
          <form onSubmit={add} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">KB番号</label>
              <input
                type="text" required placeholder="例：0925 / 1 / 30"
                className="bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white w-32"
                value={number} onChange={(e) => setNumber(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">備考</label>
              <input
                type="text" placeholder="任意"
                className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                value={notes} onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm shadow-sm">追加</button>
          </form>

          {/* 一括追加 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">まとめて追加（改行・カンマ区切り）</label>
            <textarea
              rows={2} placeholder="例）1 2 3 4 5 6 7 8 9 10 30 31 32"
              className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
              value={bulk} onChange={(e) => setBulk(e.target.value)}
            />
            <button type="button" onClick={addBulk} disabled={busy} className="mt-2 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-60 text-slate-700 font-bold text-xs">一括追加</button>
          </div>

          {error && <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold whitespace-pre-wrap">{error}</div>}

          {/* マスタ一覧 */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 mb-2">登録済み番号（{list.length}件 / 有効 {list.filter((k) => k.isActive).length}件）</div>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {list.length === 0 ? (
                <div className="px-3 py-6 text-center text-slate-400 text-xs">まだ番号が登録されていません。</div>
              ) : (
                list.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="font-mono font-bold text-slate-800 w-16">№{k.number}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${k.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {k.isActive ? '有効' : '廃止'}
                    </span>
                    <span className="flex-1 text-xs text-slate-500 truncate">{k.notes}</span>
                    <button onClick={() => toggleActive(k)} className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold">{k.isActive ? '廃止にする' : '有効に戻す'}</button>
                    <button onClick={() => remove(k)} className="px-2 py-1 rounded bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-bold">削除</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 text-right shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs">閉じる</button>
        </div>
      </div>
    </div>
  );
}
