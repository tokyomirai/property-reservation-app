'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { 
  Reservation, 
  Property,
  getReservations, 
  getProperties,
  initializeData 
} from '../../../../utils/mockData';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ReservationStatusPage({ params }: PageProps) {
  const { id } = use(params);
  
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeData();
    const loadData = () => {
      const resList = getReservations();
      const foundRes = resList.find(r => r.id === id);
      if (foundRes) {
        setReservation(foundRes);
        
        const props = getProperties();
        const foundProp = props.find(p => p.id === foundRes.propertyId);
        if (foundProp) {
          setProperty(foundProp);
        }
      }
      setLoading(false);
    };

    loadData();
    const interval = setInterval(loadData, 1500);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 bg-slate-50 text-slate-800 flex items-center justify-center">
        <p className="text-slate-500 text-sm animate-pulse font-medium">読み込み中...</p>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="flex-1 bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-rose-600 font-bold">ご指定の予約情報が見つかりませんでした。</p>
          <p className="text-xs text-slate-400">予約IDが正しいかご確認ください。</p>
          <Link href="/broker" className="inline-block text-sm text-indigo-600 hover:underline">
            ← 物件一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  const isApproved = reservation.status === '承認済';
  const isRejected = reservation.status === '却下';
  const isPending = reservation.status === '未承認';

  return (
    <div className="flex-1 bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Navigation Back */}
        <div>
          <Link href="/broker" className="inline-flex items-center text-slate-550 hover:text-slate-800 text-xs font-bold gap-1 transition-colors">
            <span>←</span> 物件一覧に戻る
          </Link>
        </div>

        {/* Success Header (Only if recently submitted, simulates status) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-md text-center space-y-4">
          <div className="flex justify-center">
            {isApproved ? (
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-3xl font-bold shadow-sm">
                ✓
              </div>
            ) : isRejected ? (
              <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 text-3xl font-bold shadow-sm">
                ✕
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 text-3xl animate-pulse shadow-sm">
                ⏳
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {isApproved ? '内見予約が承認されました' : 
               isRejected ? '内見予約をお受けできませんでした' : 
               '内見予約の申込みを受付いたしました'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-lg mx-auto leading-relaxed">
              {isPending && '現在、社内にて予約内容の確認を行っております。このまましばらくお待ちいただくか、本ページをブックマークして後ほどご確認ください。'}
              {isApproved && 'ご案内情報が確定しました。現地キーボックス等の鍵情報を開示いたします。'}
              {isRejected && '大変申し訳ございませんが、ご希望の日程でのご案内が難しいため予約を却下いたしました。詳細はお電話にてお問い合わせください。'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 inline-block font-mono text-sm shadow-inner">
            <span className="text-slate-400 font-normal">予約ID:</span> <strong className="text-slate-800 tracking-wider text-base">{reservation.id}</strong>
          </div>
        </div>

        {/* Key Information Opening Control (CRITICAL REQUIREMENT) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-md space-y-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2.5 flex items-center gap-1.5">
            <span>🔑</span> 鍵の解除情報 / 現地案内
          </h2>

          {isPending && (
            <div className="py-8 px-4 rounded-lg bg-slate-50 border border-slate-200 border-dashed text-center space-y-2">
              <span className="text-3xl">🔒</span>
              <h3 className="text-sm font-bold text-amber-600">社内確認中</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
                重要セキュリティ情報（キーボックス暗証番号・設置場所）は、社内担当者の承認後にここに開示されます。
              </p>
              <div className="pt-2">
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 animate-pulse">
                  1.5秒ごとに自動更新中... (管理画面で承認すると即座に切り替わります)
                </span>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="py-6 px-4 rounded-lg bg-rose-50 border border-rose-200 text-center space-y-2">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-sm font-bold text-rose-650">非開示 (予約未確定)</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                予約が承認されなかったため、鍵情報は開示されません。
              </p>
            </div>
          )}

          {isApproved && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-5 rounded-lg bg-emerald-50 border border-emerald-200 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <span>🔓</span> 承認済み - 鍵情報開示
                </div>
                
                {property?.hasKeyBox === 'あり' ? (
                  <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm font-bold text-slate-800">
                    <div>
                      <span className="block text-xs text-slate-400 font-normal mb-0.5">キーボックス管理番号</span>
                      <span className="text-slate-900 font-mono text-base">№ {property.keyBoxNumber || '設定なし'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 font-normal mb-0.5">解除番号 (暗証番号)</span>
                      <span className="text-emerald-700 font-mono text-lg tracking-wider bg-white px-2.5 py-0.5 rounded border border-emerald-250 inline-block shadow-inner">{property.unlockCode || '設定なし'}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-200/80 pt-3">
                      <span className="block text-xs text-slate-400 font-normal mb-0.5">キーボックス設置場所</span>
                      <span className="text-slate-850 font-medium">{property.setupLocation || '設定なし'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600 font-medium">
                    本物件はキーボックスを使用しない鍵受渡となります。お手数ですが、詳細は弊社担当者まで直接お問い合わせください。
                  </div>
                )}
              </div>

              <div className="text-[11px] sm:text-xs text-slate-500 leading-relaxed bg-slate-50 p-3.5 rounded border border-slate-200">
                <strong className="text-slate-700 block mb-1 font-bold">⚠️ 内見時の注意ルール</strong>
                ・内見終了後は、速やかに鍵を指定位置のキーボックスに戻し、ダイヤルを回して確実に施錠してください。<br />
                ・現地備品（スリッパや売り看板）は撤去・持ち出しをせず、元の状態で維持してください。
              </div>
            </div>
          )}
        </div>

        {/* Reservation Details */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-md space-y-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2.5">
            📋 お申込み内容の控え
          </h2>
          <table className="w-full text-left text-xs sm:text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 text-slate-400 font-medium">対象物件</td>
                <td className="py-2.5 text-slate-850 font-bold">{reservation.propertyName}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-400 font-medium">仲介業者名</td>
                <td className="py-2.5 text-slate-700 font-medium">{reservation.companyName}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-400 font-medium">ご担当者名</td>
                <td className="py-2.5 text-slate-700 font-medium">{reservation.agentName} 様</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-400 font-medium">連絡先電話番号</td>
                <td className="py-2.5 text-slate-600 font-mono">{reservation.phone}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-400 font-medium">メールアドレス</td>
                <td className="py-2.5 text-slate-600 font-mono">{reservation.email}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-400 font-medium">希望日時</td>
                <td className="py-2.5 text-slate-800 font-bold">{reservation.preferredDate} {reservation.preferredTime}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-400 font-medium">その他連絡事項</td>
                <td className="py-2.5 text-slate-600 whitespace-pre-wrap">{reservation.notes || 'なし'}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
