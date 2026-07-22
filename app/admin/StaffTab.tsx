'use client';

// ⑥ 担当者電話番号（会社代表番号・担当者携帯番号）と ⑦ 名刺データの管理。
// ここで登録した内容が、物件の「担当営業メールアドレス」と一致する予約の承認メールに反映される。

import { useState, useEffect, useCallback } from 'react';
import { COMPANY_PHONE } from '../../utils/company';

interface Staff {
  id: string;
  name: string;
  email: string;
  companyPhone: string;
  mobilePhone: string;
  cardFileName: string;
  cardMimeType: string;
  isActive: boolean;
  hasCard: boolean;
}

type StaffForm = {
  name: string;
  email: string;
  companyPhone: string;
  mobilePhone: string;
  cardFileName: string;
  cardMimeType: string;
  cardData: string;
  isActive: boolean;
  removeCard: boolean;
};

const EMPTY_FORM: StaffForm = {
  name: '',
  email: '',
  companyPhone: '',
  mobilePhone: '',
  cardFileName: '',
  cardMimeType: '',
  cardData: '',
  isActive: true,
  removeCard: false,
};

// 名刺ファイルの上限（メール添付を考慮して1.5MBまで）
const MAX_CARD_BYTES = 1.5 * 1024 * 1024;

/** ファイルを Base64 文字列（データURLのプレフィックスなし）へ変換する。 */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function StaffTab() {
  // 読み込み前は null。ローディング表示はこの値から導出する。
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/staff');
      setStaff(res.ok ? await res.json() : []);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
      setStaff([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/staff')
      .then((res) => (res.ok ? res.json() : []))
      .catch((err) => {
        console.error('Failed to fetch staff:', err);
        return [];
      })
      .then((data) => {
        if (!cancelled) setStaff(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      email: s.email,
      companyPhone: s.companyPhone,
      mobilePhone: s.mobilePhone,
      // 既存の名刺は再アップロードしない限り保持する
      cardFileName: s.cardFileName,
      cardMimeType: s.cardMimeType,
      cardData: '',
      isActive: s.isActive,
      removeCard: false,
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleCardChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_CARD_BYTES) {
      setError('名刺ファイルのサイズが大きすぎます（1.5MBまで）。');
      e.target.value = '';
      return;
    }
    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
      setError('名刺は PNG / JPG / PDF のいずれかを選択してください。');
      e.target.value = '';
      return;
    }

    try {
      const base64 = await readAsBase64(file);
      setForm((prev) => ({
        ...prev,
        cardFileName: file.name,
        cardMimeType: file.type,
        cardData: base64,
        removeCard: false,
      }));
      setError('');
    } catch (err) {
      console.error(err);
      setError('名刺ファイルの読み込みに失敗しました。');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(editingId ? `/api/staff/${editingId}` : '/api/staff', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || '担当者の保存に失敗しました。');
        return;
      }
      await refresh();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      setError('担当者の保存に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (s: Staff) => {
    if (!confirm(`担当者「${s.name}」を削除します。\n\nこの操作は取り消せません。よろしいですか？`)) return;
    try {
      const res = await fetch(`/api/staff/${s.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await refresh();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('担当者の削除に失敗しました。');
    }
  };

  if (staff === null) {
    return (
      <div className="bg-white border border-slate-200 rounded-b-xl p-12 text-center shadow-md">
        <p className="text-slate-500 text-sm animate-pulse font-medium">担当者情報を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-md">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <span>👤</span> 担当者マスタ（電話番号・名刺）
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            物件の「担当営業メールアドレス」と一致する担当者の電話番号・名刺が、承認メールに反映されます。
          </p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/10 transition-colors whitespace-nowrap"
        >
          ➕ 担当者を追加
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-slate-505 text-xs font-bold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">担当者名 / メール</th>
              <th className="px-4 py-4">会社代表番号</th>
              <th className="px-4 py-4">担当携帯番号</th>
              <th className="px-4 py-4">名刺</th>
              <th className="px-4 py-4">状態</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  担当者が登録されていません。「担当者を追加」から登録してください。
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{s.name}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{s.email}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap font-mono text-slate-700">
                    {s.companyPhone || <span className="text-slate-400">{COMPANY_PHONE}（既定）</span>}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap font-mono text-slate-700">
                    {s.mobilePhone || (
                      <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                        未登録
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {s.hasCard ? (
                      <span
                        className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold"
                        title={s.cardFileName}
                      >
                        添付あり
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-500 text-xs">なし</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {s.isActive ? (
                      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                        有効
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold">
                        無効
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                    <button
                      onClick={() => openEdit(s)}
                      className="px-3.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 transition-colors font-bold shadow-sm"
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- モーダル: 担当者の登録・編集 --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? '👤 担当者情報の編集' : '👤 担当者の追加'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    担当者名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例：山田 太郎"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    メールアドレス <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="例：yamada@tokyomf.co.jp"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 -mt-2">
                ※ 物件側の「担当営業メールアドレス」と同じアドレスを登録してください。
              </p>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                <div className="col-span-2">
                  <h4 className="text-sm font-bold text-indigo-600 mb-1">☎️ 承認メールに表示する電話番号</h4>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">会社代表番号</label>
                  <input
                    type="tel"
                    placeholder={`未入力なら ${COMPANY_PHONE}`}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={form.companyPhone}
                    onChange={(e) => setForm({ ...form, companyPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">担当携帯番号（直通）</label>
                  <input
                    type="tel"
                    placeholder="例：090-1234-5678"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={form.mobilePhone}
                    onChange={(e) => setForm({ ...form, mobilePhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h4 className="text-sm font-bold text-indigo-600">💳 名刺（承認メールに添付）</h4>

                {(form.cardFileName || form.cardData) && !form.removeCard && (
                  <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-700 font-medium truncate">
                      📎 {form.cardFileName}
                      {form.cardData && <span className="text-emerald-600 font-bold ml-2">（新しく選択）</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, cardFileName: '', cardMimeType: '', cardData: '', removeCard: true })
                      }
                      className="shrink-0 px-2.5 py-1 rounded bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-bold"
                    >
                      削除
                    </button>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={handleCardChange}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-slate-250 file:bg-slate-100 file:text-slate-700 file:text-xs file:font-bold hover:file:bg-slate-200 file:cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">
                  PNG / JPG / PDF・1.5MBまで。担当者ごとに個別の名刺を登録できます。
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">状態</label>
                <select
                  className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  value={form.isActive ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
                >
                  <option value="true">有効</option>
                  <option value="false">無効</option>
                </select>
              </div>

              {error && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold whitespace-pre-wrap">
                  ⚠️ {error}
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md"
                >
                  {submitting ? '保存中...' : '保存する'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = staff.find((s) => s.id === editingId);
                      if (target) handleDelete(target);
                    }}
                    className="px-4 py-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-sm border border-rose-200"
                  >
                    削除
                  </button>
                )}
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
