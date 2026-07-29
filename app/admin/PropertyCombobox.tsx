'use client';

// 物件選択用の「検索付きコンボボックス」。外部ライブラリは使わず自前実装。
// 物件名・住所の部分一致（NFKC正規化・大文字小文字無視）で候補を絞り込み、
// 候補は「物件名／住所」の2行で表示する。社内案内予約の登録フォームで使用する。

import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';

export interface PropertyOption {
  id: string;
  name: string;
  address: string;
}

interface Props {
  options: PropertyOption[];
  /** 選択中の物件ID（未選択は ''） */
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

const norm = (s: string) => s.normalize('NFKC').toLowerCase();

export default function PropertyCombobox({ options, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.id === value) || null;

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return options;
    return options.filter((o) => norm(o.name).includes(q) || norm(o.address).includes(q));
  }, [options, query]);

  // 外側クリックで閉じる
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const openList = () => {
    setQuery('');
    setActiveIdx(0);
    setOpen(true);
  };

  const select = (o: PropertyOption) => {
    onChange(o.id);
    setOpen(false);
    setQuery('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      openList();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIdx]) select(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // アクティブ項目を表示範囲内へスクロール
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        {/* 虫眼鏡アイコン */}
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          value={open ? query : selected ? selected.name : ''}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
            if (!open) setOpen(true);
          }}
          onFocus={openList}
          onKeyDown={handleKey}
          placeholder={placeholder || '物件名・住所で検索'}
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-250 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
        />
        {/* 開閉シェブロン */}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? '閉じる' : '開く'}
          onClick={() => (open ? setOpen(false) : openList())}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-400">該当する物件がありません</li>
          ) : (
            filtered.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  // input の blur より先に選択を確定させるため mousedown で処理
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(o);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    i === activeIdx ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  } ${o.id === value ? 'ring-1 ring-inset ring-indigo-200' : ''}`}
                >
                  <div className="text-sm font-bold text-slate-800 truncate">{o.name}</div>
                  <div className="text-xs text-slate-500 truncate">📍 {o.address || '住所未登録'}</div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
