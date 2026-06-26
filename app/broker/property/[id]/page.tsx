'use client';

import { useState, useEffect, use } from 'react';
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
}

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function PropertyDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  // フォームState
  const [formData, setFormData] = useState({
    companyName: '',
    agentName: '',
    phone: '',
    email: '',
    preferredDate: '',
    preferredTime: '',
    notes: '',
  });

  useEffect(() => {
    fetch(`/api/properties/${id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch property');
        }
        return res.json();
      })
      .then((data) => {
        setProperty(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;

    if (property.viewingStatus !== '内見可能') {
      alert('現在、この物件は内見をお申込みいただけません。');
      return;
    }

    fetch('/api/reservations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: property.id,
        companyName: formData.companyName,
        agentName: formData.agentName,
        phone: formData.phone,
        email: formData.email,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        notes: formData.notes,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to submit reservation');
        }
        return res.json();
      })
      .then((newRes) => {
        router.push(`/broker/reservation/${newRes.id}`);
      })
      .catch((err) => {
        console.error(err);
        alert('予約の送信に失敗しました。入力内容を確認の上、再度お試しください。');
      });
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-50 text-slate-800 flex items-center justify-center">
        <p className="text-slate-500 text-sm animate-pulse font-medium">読み込み中...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex-1 bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-rose-600 font-bold">物件が見つかりませんでした。</p>
          <Link href="/broker" className="inline-block text-sm text-indigo-600 hover:underline">
            ← 物件一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  const isViewable = property.viewingStatus === '内見可能';

  return (
    <div className="flex-1 bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation Back */}
        <div>
          <Link href="/broker" className="inline-flex items-center text-slate-550 hover:text-slate-800 text-xs font-bold gap-1 transition-colors">
            <span>←</span> 物件一覧に戻る
          </Link>
        </div>

        {/* Property Detail Summary (Public) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-md space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{property.name}</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">📍 {property.address}</p>
          </div>

          <div className="flex gap-2">
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
              property.salesStatus === '販売中' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
              property.salesStatus === '申込あり' ? 'bg-amber-50 text-amber-700 border border-amber-250' :
              property.salesStatus === '契約予定' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
              property.salesStatus === '契約済' ? 'bg-slate-100 text-slate-650 border border-slate-200' :
              'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              販売状況: {property.salesStatus}
            </span>
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
              property.viewingStatus === '内見可能' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              property.viewingStatus === '日程調整' ? 'bg-amber-50 text-amber-700 border border-amber-250' :
              property.viewingStatus === 'リフォーム中' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
              'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              内見状況: {property.viewingStatus}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs sm:text-sm text-slate-600 leading-relaxed shadow-inner">
            <strong className="text-slate-800 block mb-1 font-bold">💡 案内事項・備考</strong>
            <p>{property.notes || '特別な注意事項はありません。内見をご希望の場合は以下のフォームよりご予約ください。'}</p>
          </div>
        </div>

        {/* Booking Form Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-md space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-850 flex items-center gap-2">
              <span>📅</span> 内見予約お申込みフォーム
            </h2>
            <p className="text-slate-500 text-xs mt-1 font-medium">
              必要事項をご入力の上、送信してください。社内で承認され次第、鍵情報（暗証番号など）が自動で開示されます。
            </p>
          </div>

          {!isViewable ? (
            <div className="p-4 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs sm:text-sm text-center font-semibold animate-pulse">
              ⚠️ 現在、この物件は <strong>{property.viewingStatus}</strong> のため内見予約を受け付けておりません。
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">仲介業者名 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="例: みらい不動産株式会社"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={formData.companyName}
                    onChange={e => setFormData({...formData, companyName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ご担当者名 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="例: 山田 太郎"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={formData.agentName}
                    onChange={e => setFormData({...formData, agentName: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">電話番号 <span className="text-rose-500">*</span></label>
                  <input
                    type="tel"
                    required
                    placeholder="例: 03-1234-5678"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">メールアドレス <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    placeholder="例: agent@mirai-re.jp"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">内見希望日 <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={formData.preferredDate}
                    onChange={e => setFormData({...formData, preferredDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">内見希望時間 <span className="text-rose-500">*</span></label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={formData.preferredTime}
                    onChange={e => setFormData({...formData, preferredTime: e.target.value})}
                  >
                    <option value="">-- 希望時間を選択 --</option>
                    <option value="10:00〜12:00">10:00〜12:00</option>
                    <option value="12:00〜14:00">12:00〜14:00</option>
                    <option value="14:00〜16:00">14:00〜16:00</option>
                    <option value="16:00〜18:00">16:00〜18:00</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">その他連絡事項</label>
                <textarea
                  rows={3}
                  placeholder="同行者人数や、事前に確認しておきたいことなどがあれば入力してください。"
                  className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full px-5 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 hover:opacity-95 text-white font-bold text-sm tracking-wide shadow-md shadow-emerald-600/10 transition-all duration-200"
                >
                  予約申込みを送信する
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
