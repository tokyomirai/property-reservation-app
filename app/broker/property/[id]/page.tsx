'use client';

import { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ALLOWED_CARD_TYPES,
  ALLOWED_CARD_LABEL,
  MAX_CARD_BYTES,
} from '../../../../utils/businessCard';
import {
  normalizeViewingStartDate,
  formatViewingDateJp,
  isBeforeViewingStart,
  viewingStartErrorMessage,
} from '../../../../utils/viewingWindow';

interface Property {
  id: string;
  name: string;
  address: string;
  salesStatus: string;
  viewingStatus: string;
  // 内見受付開始日（"YYYY-MM-DD"）。未設定は null。
  viewingStartDate?: string | null;
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
    phone: '',       // 会社電話番号
    mobilePhone: '', // 担当者携帯番号
    email: '',
    preferredDate: '',
    startTime: '',
    endTime: '',
    cardFileName: '',
    cardMimeType: '',
    cardData: '',
    notes: '',
    website: '', // ハニーポット（ボット対策・人間は入力しない）
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  // 名刺（必須）未添付時のエラーと、該当欄へのスクロール／フォーカス用
  const [cardError, setCardError] = useState('');
  const cardSectionRef = useRef<HTMLDivElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);

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

  // 名刺（JPG / PNG / PDF）を読み込んでBase64で保持する
  const handleCardChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!(ALLOWED_CARD_TYPES as readonly string[]).includes(file.type)) {
      setFormError(`名刺は ${ALLOWED_CARD_LABEL} のいずれかの形式でアップロードしてください。`);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_CARD_BYTES) {
      setFormError('名刺ファイルのサイズが大きすぎます（5MBまで）。');
      e.target.value = '';
      return;
    }

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result ?? '');
          resolve(result.slice(result.indexOf(',') + 1));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setFormData((prev) => ({
        ...prev,
        cardFileName: file.name,
        cardMimeType: file.type,
        cardData: base64,
      }));
      setFormError('');
      setCardError('');
    } catch (err) {
      console.error(err);
      setFormError('名刺ファイルの読み込みに失敗しました。');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || submitting) return;

    if (!property.isPublished) {
      setFormError('この物件は現在非公開のため、内見予約を受け付けていません。');
      return;
    }

    if (property.viewingStatus !== '内見可能' && property.viewingStatus !== 'リフォーム後の予約受付中') {
      setFormError('現在、この物件は内見をお申込みいただけません。');
      return;
    }

    // 内見受付開始日より前の希望日は受け付けない（サーバー側でも再検証する）。
    if (isBeforeViewingStart(formData.preferredDate, property.viewingStartDate)) {
      setFormError(viewingStartErrorMessage(property.viewingStartDate));
      return;
    }

    // 名刺画像は必須。未添付なら送信せず、該当欄へスクロール＋フォーカスして案内する。
    if (!formData.cardData) {
      setCardError('名刺画像を添付してください。');
      cardSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cardInputRef.current?.focus();
      return;
    }

    if (formData.endTime <= formData.startTime) {
      setFormError('終了時間は開始時間より後の時刻をご指定ください。');
      return;
    }

    setFormError('');
    setCardError('');
    setSubmitting(true);

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
        mobilePhone: formData.mobilePhone,
        email: formData.email,
        preferredDate: formData.preferredDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        cardFileName: formData.cardFileName,
        cardMimeType: formData.cardMimeType,
        cardData: formData.cardData,
        notes: formData.notes,
        website: formData.website,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          // サーバー側の理由（重複・レート制限・入力エラー等）をそのまま案内する
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || '予約の送信に失敗しました。入力内容を確認の上、再度お試しください。');
        }
        return res.json();
      })
      .then((newRes) => {
        router.push(`/broker/reservation/${newRes.id}`);
      })
      .catch((err) => {
        console.error(err);
        setFormError(err?.message || '予約の送信に失敗しました。入力内容を確認の上、再度お試しください。');
        setSubmitting(false);
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

  const isViewable = property.viewingStatus === '内見可能' || property.viewingStatus === 'リフォーム後の予約受付中';
  const startDate = normalizeViewingStartDate(property.viewingStartDate);

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
              property.viewingStatus === 'リフォーム後の予約受付中' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
              property.viewingStatus === 'リフォーム中' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
              property.viewingStatus === '解体中' ? 'bg-stone-200 text-stone-700 border border-stone-300' :
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
              必要事項をご入力の上、送信してください。社内で承認後、鍵情報（暗証番号など）は内見日の前日から予約状況ページに表示されます。
            </p>
          </div>

          {!property.isPublished ? (
            // 非公開は公開状況を優先し、予約受付対象外（社内ログインで直接開いた場合も申込不可）
            <div className="p-4 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-xs sm:text-sm text-center font-semibold">
              非公開のため内見予約受付対象外
            </div>
          ) : !isViewable ? (
            <div className="p-4 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs sm:text-sm text-center font-semibold animate-pulse">
              ⚠️ 現在、この物件は <strong>{property.viewingStatus}</strong> のため内見予約を受け付けておりません。
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 内見受付開始日の案内（備考を読まなくても予約可能日が分かるよう明示） */}
              {startDate && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm font-bold text-center leading-relaxed">
                  {property.viewingStatus === 'リフォーム後の予約受付中'
                    ? `🛠 リフォーム後の予約受付中のため、${formatViewingDateJp(startDate)}以降の内見予約を受け付けています。`
                    : `🗓 内見受付開始日：${formatViewingDateJp(startDate)}～`}
                </div>
              )}
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">会社電話番号 <span className="text-rose-500">*</span></label>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">担当者携帯番号 <span className="text-rose-500">*</span></label>
                  <input
                    type="tel"
                    required
                    placeholder="例: 090-1234-5678"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={formData.mobilePhone}
                    onChange={e => setFormData({...formData, mobilePhone: e.target.value})}
                  />
                </div>
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

              {/* 名刺のアップロード（JPG / PNG / PDF）※必須 */}
              <div ref={cardSectionRef} className="scroll-mt-24">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  名刺画像 <span className="text-rose-500">【必須】</span>
                </label>
                {formData.cardFileName ? (
                  <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                    <span className="text-xs text-emerald-800 font-bold truncate">
                      📎 {formData.cardFileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, cardFileName: '', cardMimeType: '', cardData: '' })}
                      className="shrink-0 px-2.5 py-1 rounded bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-bold"
                    >
                      取り消す
                    </button>
                  </div>
                ) : (
                  <input
                    ref={cardInputRef}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={handleCardChange}
                    className={`w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:bg-slate-100 file:text-slate-700 file:text-xs file:font-bold hover:file:bg-slate-200 file:cursor-pointer ${
                      cardError ? 'file:border-rose-400' : 'file:border-slate-250'
                    }`}
                  />
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  {ALLOWED_CARD_LABEL} 形式・5MBまで。ご担当者様の名刺を必ずアップロードしてください。
                </p>
                {cardError && (
                  <p className="mt-1.5 text-xs font-bold text-rose-600">⚠️ {cardError}</p>
                )}
              </div>

              {/* 内見希望日 ＋ 開始/終了時間 */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">内見希望日 <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    min={startDate || undefined}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={formData.preferredDate}
                    onChange={e => setFormData({...formData, preferredDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">開始時間 <span className="text-rose-500">*</span></label>
                  <input
                    type="time"
                    required
                    step={900}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">終了時間 <span className="text-rose-500">*</span></label>
                  <input
                    type="time"
                    required
                    step={900}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={formData.endTime}
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 -mt-1">
                例）開始 10:00 ／ 終了 11:00　※ 既に予約が入っている時間帯はお申込みいただけません。
              </p>

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

              {/* ハニーポット: 人間には見えない項目。ボットが入力するとスパムとして弾く */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={formData.website}
                onChange={e => setFormData({...formData, website: e.target.value})}
              />

              {/* 重複・入力エラーの案内 */}
              {formError && (
                <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-semibold whitespace-pre-wrap leading-relaxed">
                  ⚠️ {formError}
                </div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-5 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm tracking-wide shadow-md shadow-emerald-600/10 transition-all duration-200"
                >
                  {submitting ? '送信中...' : '予約申込みを送信する'}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
