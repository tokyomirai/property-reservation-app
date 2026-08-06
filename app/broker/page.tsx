'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Property {
  id: string;
  name: string;
  address: string;
  salesStatus: string;
  viewingStatus: string;
  isPublished: boolean;
  hasSlippers: string;
  hasSignboard: string;
  notes: string;
  documentUrl?: string;
  youtubeUrl?: string;
  panoramaUrl?: string;
}

export default function BrokerPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [reservationIdInput, setReservationIdInput] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/properties')
      .then((res) => res.json())
      .then((data) => {
        setProperties(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch properties:', err);
        setLoading(false);
      });
  }, []);

  const handleSearchReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservationIdInput.trim()) return;
    router.push(`/broker/reservation/${reservationIdInput.trim()}`);
  };

  const filteredProperties = properties.filter(prop => 
    prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prop.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
        
        {/* Corporate Hero Banner (Teal to Blue gradient matching HP) */}
        <div className="relative rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 border border-transparent p-6 sm:p-8 shadow-lg text-white">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2 drop-shadow-sm">
              <span>🤝</span> 仲介会社様向け 物件確認・内見受付窓口
            </h1>
            <p className="text-blue-50 text-xs sm:text-sm leading-relaxed font-medium">
              リアルタイムで現在の販売状況と内見状況をご確認いただけます。お電話での状況確認は不要です。<br />
              内見をご希望の際は、各物件の「内見予約を申し込む」ボタンよりお申込みください。
            </p>
          </div>
        </div>

        {/* Dynamic Controls Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Property Filter */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">🔍 物件を検索</h3>
              <p className="text-xs text-slate-400 mb-4 font-medium">物件名または住所を入力してください。</p>
            </div>
            <input
              type="text"
              placeholder="例: 千代田、恵比寿..."
              className="w-full bg-slate-50 border border-slate-250 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Reservation Status Tracker */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent mb-1">🔑 予約状況・鍵情報の確認</h3>
              <p className="text-xs text-slate-400 mb-4 font-medium">
                送信済みの予約ID（例: clx45u6...）を入力して、承認ステータスと鍵解除情報を確認できます。
              </p>
            </div>
            <form onSubmit={handleSearchReservation} className="flex gap-2">
              <input
                type="text"
                placeholder="予約IDを入力"
                className="flex-1 bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono tracking-wider transition-colors"
                value={reservationIdInput}
                onChange={e => setReservationIdInput(e.target.value)}
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold tracking-wide shadow-sm transition-colors"
              >
                照会
              </button>
            </form>
          </div>
        </div>

        {/* Properties Grid */}
        <div className="space-y-4">
          <h2 className="text-base font-extrabold text-slate-700 border-b border-slate-200 pb-2.5 flex items-center gap-2">
            <span>📋</span> 公開物件一覧
            <span className="text-xs font-semibold text-slate-400 font-mono">({filteredProperties.length} 件)</span>
          </h2>
          
          {loading ? (
            <div className="text-center py-12 text-slate-405">
              読み込み中...
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-250 rounded-xl bg-white shadow-sm">
              該当する物件が見つかりませんでした。
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((prop) => {
                const isViewable = prop.viewingStatus === '内見可能' || prop.viewingStatus === 'リフォーム後の予約受付中';
                // 資料/動画/360°の3枠。URLが登録されている項目のみクリック可能。
                const actions = [
                  { key: 'doc', label: '📄 詳細資料', href: prop.documentUrl || '' },
                  { key: 'tour', label: '▶ ルームツアー動画', href: prop.youtubeUrl || '' },
                  { key: 'pano', label: '360°カメラ', href: prop.panoramaUrl || '' },
                ];
                return (
                  <div 
                    key={prop.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 hover:border-slate-300 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 shadow-sm"
                  >
                    <div className="space-y-4">
                      {/* Name / Address */}
                      <div>
                        <h3 className="text-base font-bold text-slate-850 line-clamp-1 group-hover:text-indigo-600">{prop.name}</h3>
                        <p className="text-xs text-slate-550 mt-1 line-clamp-1">📍 {prop.address}</p>
                      </div>

                      {/* Status Badges */}
                      <div className="flex gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          prop.salesStatus === '販売中' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                          prop.salesStatus === '申込あり' ? 'bg-amber-50 text-amber-700 border border-amber-250' :
                          prop.salesStatus === '契約予定' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          prop.salesStatus === '契約済' ? 'bg-slate-100 text-slate-650 border border-slate-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {prop.salesStatus}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          prop.viewingStatus === '内見可能' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          prop.viewingStatus === 'リフォーム後の予約受付中' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          prop.viewingStatus === 'リフォーム中' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                          prop.viewingStatus === '解体中' ? 'bg-stone-200 text-stone-700 border border-stone-300' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {prop.viewingStatus}
                        </span>
                      </div>

                      {/* Notes (Publicly accessible field) */}
                      <div className="bg-slate-50 rounded-lg p-3.5 text-xs text-slate-600 leading-relaxed border border-slate-150 shadow-inner">
                        <strong className="text-slate-800 block mb-1 font-bold">💡 案内事項・備考</strong>
                        <p className="line-clamp-3 min-h-[48px]">
                          {prop.notes || '特別な注意事項はありません。内見をご希望の場合は予約フォームよりお手続きください。'}
                        </p>
                      </div>
                    </div>

                    {/* Booking Action */}
                    <div className="mt-6">
                      {!prop.isPublished ? (
                        // 非公開は公開状況を優先し、予約不可（社内ログインで表示された場合も予約させない）
                        <button
                          disabled
                          className="block w-full text-center px-4 py-2.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed border border-slate-200"
                        >
                          非公開のため内見予約受付対象外
                        </button>
                      ) : isViewable ? (
                        <Link
                          href={`/broker/property/${prop.id}`}
                          className="block w-full text-center px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 hover:opacity-95 text-white text-xs font-bold tracking-wide transition-all shadow-md shadow-emerald-600/10"
                        >
                          内見予約を申し込む
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="block w-full text-center px-4 py-2.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed border border-slate-200"
                        >
                          {prop.viewingStatus === '内見不可' ? '現在内見不可' : `現在内見不可（${prop.viewingStatus}）`}
                        </button>
                      )}

                      {/* 詳細資料 / ルームツアー動画 / 360°カメラ
                          常に3枠を均等幅・同一サイズで表示。未登録は「準備中」の無効表示。
                          ・項目名は必ず1行（whitespace-nowrap）
                          ・アイコン/項目名/準備中を縦横中央に配置（flex中央揃え）
                          ・PCは3列、スマホは1列に折り返す */}
                      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {actions.map((a) =>
                          a.href ? (
                            <a
                              key={a.key}
                              href={a.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`${a.label}を開く`}
                              className="flex flex-col items-center justify-center text-center h-14 px-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 text-[11px] font-bold shadow-sm transition-colors"
                            >
                              <span className="whitespace-nowrap leading-tight">{a.label}</span>
                              {/* 準備中ボタンと高さを揃えるための不可視スペーサー */}
                              <span aria-hidden="true" className="whitespace-nowrap text-[10px] font-semibold invisible leading-none">準備中</span>
                            </a>
                          ) : (
                            <button
                              key={a.key}
                              type="button"
                              disabled
                              aria-disabled="true"
                              className="flex flex-col items-center justify-center text-center h-14 px-1 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 text-[11px] font-bold cursor-not-allowed select-none"
                            >
                              <span className="whitespace-nowrap leading-tight">{a.label}</span>
                              <span className="whitespace-nowrap text-[10px] font-semibold leading-none mt-0.5">準備中</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
