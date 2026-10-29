'use client';

import { useState, useEffect } from 'react';
import { renderManualMarkdown } from '../../utils/manualMarkdown';

// 利用マニュアル（社内向け）。
//   1ページ目「社員の操作手順」= DB保存・画面から編集可（info@tokyomf.co.jp のみ）。
//   2ページ目以降「システム機能説明」= コード側で表示（現行仕様の一覧）。
//   ※ステップ3で、2ページ目の各表を共通定数から自動生成し、コード変更が自動反映されるようにする予定。

interface ManualData {
  contentMd: string;
  updatedByName: string;
  updatedAt: string | null;
  isDefault: boolean;
  canEdit: boolean;
}

export default function ManualTab() {
  const [data, setData] = useState<ManualData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/manual');
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setError('マニュアルの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  function startEdit() {
    if (!data) return;
    setDraft(data.contentMd);
    setError('');
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/manual', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentMd: draft }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || '保存に失敗しました');
        return;
      }
      setData(j);
      setEditing(false);
    } catch {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const updatedLabel = (() => {
    if (!data) return '';
    if (data.isDefault) return '未保存（既定の内容を表示中）';
    const who = data.updatedByName || '不明';
    const when = data.updatedAt ? new Date(data.updatedAt).toLocaleString('ja-JP') : '';
    return `最終更新：${who}${when ? '／' + when : ''}`;
  })();

  return (
    <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 p-5 md:p-7">
      <style>{`
        .manual-body { font-size:.9rem; line-height:1.95; color:#334155; }
        .manual-body h2 { font-size:1.1rem; font-weight:700; color:#3730a3; border-left:4px solid #6366f1; padding-left:10px; margin:2rem 0 .7rem; line-height:1.5; }
        .manual-body h3 { font-size:1rem; font-weight:700; color:#334155; margin:1.5rem 0 .5rem; line-height:1.5; }
        .manual-body p { margin:.7rem 0; line-height:1.95; }
        .manual-body ul { list-style:disc; padding-left:1.5rem; margin:.6rem 0; }
        .manual-body ol { list-style:decimal; padding-left:1.5rem; margin:.6rem 0; }
        .manual-body li { margin:.4rem 0; line-height:1.9; }
        .manual-body ul ul, .manual-body ol ul, .manual-body ol ol, .manual-body ul ol { margin:.3rem 0; }
        .manual-body ul ul li, .manual-body ol ul li { margin:.25rem 0; }
        .manual-body strong { font-weight:700; color:#1e293b; }
        .manual-body a { color:#4f46e5; text-decoration:underline; }
        .manual-note { background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:12px 14px; margin:.9rem 0; line-height:1.95; color:#334155; }
      `}</style>

      <div className="max-w-3xl mx-auto text-slate-800 leading-7">
        {/* タイトル */}
        <h1 className="text-2xl font-extrabold text-slate-900 border-b-2 border-indigo-600 pb-2">
          利用マニュアル — 内見予約システム／キーボックス管理台帳
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          システムの社内管理画面は <strong>@tokyomf.co.jp</strong> のGoogleアカウントでログインしてください。
        </p>

        {/* ============ 1ページ目：社員の操作手順（編集可） ============ */}
        <div className="flex items-center justify-between gap-2 mt-8">
          <h2 className="text-lg font-bold text-indigo-800 border-l-4 border-indigo-500 pl-2">
            【1ページ目】社員の操作手順
          </h2>
          {data?.canEdit && !editing && (
            <button
              onClick={startEdit}
              className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              ✏️ 編集
            </button>
          )}
        </div>
        <p className="text-sm text-slate-600 mt-1">
          日常業務で行う操作を、流れの順にまとめています。まずはこのページだけ覚えれば運用できます。
        </p>

        {loading && <p className="text-sm text-slate-400 mt-4">読み込み中…</p>}

        {error && !editing && (
          <p className="text-sm text-rose-600 mt-3 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>
        )}

        {/* 閲覧モード */}
        {!loading && data && !editing && (
          <>
            <div
              className="manual-body mt-3"
              dangerouslySetInnerHTML={{ __html: renderManualMarkdown(data.contentMd) }}
            />
            <p className="text-xs text-slate-400 mt-4">{updatedLabel}</p>
          </>
        )}

        {/* 編集モード（info@tokyomf.co.jp のみ） */}
        {editing && (
          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-2 bg-slate-50 border border-slate-200 rounded px-3 py-2 leading-5">
              Markdown記法で編集できます：
              <span className="font-mono">## 見出し</span> ／
              <span className="font-mono">### 小見出し</span> ／
              <span className="font-mono">1. 2. 3.</span>（番号付き） ／
              <span className="font-mono">- </span>（箇条書き・行頭に半角スペース3つで字下げ） ／
              <span className="font-mono">**太字**</span> ／
              <span className="font-mono">&gt; </span>（注記ボックス）
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 入力 */}
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                className="w-full h-[460px] text-sm font-mono border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
              />
              {/* プレビュー */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 overflow-auto h-[460px]">
                <p className="text-[11px] font-bold text-slate-400 mb-1">プレビュー</p>
                <div
                  className="manual-body"
                  dangerouslySetInnerHTML={{ __html: renderManualMarkdown(draft) }}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-rose-600 mt-3 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中…' : '💾 保存'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setError('');
                }}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        <hr className="my-8 border-dashed border-slate-300" />

        {/* ============ 2ページ目以降：システム機能説明（コード表示） ============ */}
        <h2 className="text-lg font-bold text-indigo-800 mt-4 border-l-4 border-indigo-500 pl-2">
          【2ページ目以降】システム機能説明（現行の実装）
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          ここからは各画面でできることの一覧です（システムの現行仕様）。詳細を確認したいときに参照してください。
        </p>

        <SystemReference />
      </div>
    </div>
  );
}

// 2ページ目以降：システムの現行機能一覧（表示のみ）。
// ステップ3で、販売状況・予約ボタン規則・KB状態などを共通定数から自動生成する予定。
function SystemReference() {
  return (
    <div className="text-slate-800 leading-8">
      <h3 className="text-base font-bold text-slate-700 mt-6">システム全体の構成</h3>
      <table className="w-full text-sm border-collapse mt-2">
        <thead>
          <tr className="bg-indigo-50">
            <th className="border border-slate-300 px-3 py-1.5 text-left">画面</th>
            <th className="border border-slate-300 px-3 py-1.5 text-left">URL</th>
            <th className="border border-slate-300 px-3 py-1.5 text-left">ログイン</th>
            <th className="border border-slate-300 px-3 py-1.5 text-left">役割</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 px-3 py-1.5">仲介会社向け画面</td>
            <td className="border border-slate-300 px-3 py-1.5">/broker</td>
            <td className="border border-slate-300 px-3 py-1.5">不要</td>
            <td className="border border-slate-300 px-3 py-1.5">公開物件の確認・内見予約の申込</td>
          </tr>
          <tr>
            <td className="border border-slate-300 px-3 py-1.5">社内管理画面</td>
            <td className="border border-slate-300 px-3 py-1.5">/admin</td>
            <td className="border border-slate-300 px-3 py-1.5">必要（@tokyomf.co.jp）</td>
            <td className="border border-slate-300 px-3 py-1.5">物件・予約・カレンダー・キーボックス管理</td>
          </tr>
        </tbody>
      </table>

      <h3 className="text-base font-bold text-slate-700 mt-6">仲介会社向け画面（/broker）</h3>
      <ul className="list-disc pl-6 mt-2 space-y-2 text-sm">
        <li>公開中の物件のみ表示（非公開・仕入決済前・売却済みは非表示）。物件名・住所で検索可能。</li>
        <li>各カードに表示：販売状況／内見状況／詳細資料・ルームツアー・360°カメラのリンク／予約ボタン。</li>
      </ul>
      <p className="text-sm mt-2">予約ボタンの表示ルール：</p>
      <table className="w-full text-sm border-collapse mt-1">
        <thead>
          <tr className="bg-indigo-50">
            <th className="border border-slate-300 px-3 py-1.5 text-left">状況</th>
            <th className="border border-slate-300 px-3 py-1.5 text-left">ボタン表示</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 px-3 py-1.5">内見可能／リフォーム後の予約受付中</td>
            <td className="border border-slate-300 px-3 py-1.5">「内見予約を申し込む」</td>
          </tr>
          <tr>
            <td className="border border-slate-300 px-3 py-1.5">内見不可</td>
            <td className="border border-slate-300 px-3 py-1.5">「現在内見不可」</td>
          </tr>
          <tr>
            <td className="border border-slate-300 px-3 py-1.5">リフォーム中／解体中</td>
            <td className="border border-slate-300 px-3 py-1.5">「現在内見不可（◯◯）」</td>
          </tr>
          <tr>
            <td className="border border-slate-300 px-3 py-1.5">内見受付開始日が設定</td>
            <td className="border border-slate-300 px-3 py-1.5">「内見受付開始日：◯月◯日〜」を併記。開始日前は申込不可</td>
          </tr>
        </tbody>
      </table>
      <ul className="list-disc pl-6 mt-2 space-y-2 text-sm">
        <li>申込フォームの入力：仲介業者名・ご担当者名・会社電話番号・担当者携帯番号・メールアドレス・名刺画像（必須）・内見希望日・開始/終了時間・その他連絡事項。</li>
        <li>名刺画像は必須（JPG/PNG/PDF・5MBまで）。未添付では送信不可。</li>
        <li>受付開始日前の日付・既存予約と重複する時間帯は申込不可。</li>
        <li>送信すると予約IDが発行される。トップの「予約状況・鍵情報の確認」に予約IDを入れると状況照会できる。</li>
        <li>鍵情報（暗証番号など）は、承認済みかつ内見日の前日〜翌日のみ表示される。</li>
      </ul>

      <h3 className="text-base font-bold text-slate-700 mt-6">社内管理画面（/admin）</h3>
      <p className="text-sm font-bold mt-2">📋 物件管理</p>
      <ul className="list-disc pl-6 mt-1 space-y-2 text-sm">
        <li>新規登録・現況更新（公開設定／販売状況／仕入決済前／内見状況／内見受付開始日／鍵・KB／スリッパ・売り看板／備考・社内メモ・担当営業メール／公開リンク）。</li>
        <li>絞り込み：公開設定・販売状況・内見状況・仕入決済前の各セレクト ＋「売却済みのみ」トグル ＋物件名/住所検索（件数表示あり）。</li>
        <li>「🏷️ 売却済みにする」：物理削除せず保管（備品回収確認モーダル付き）。「物件削除」は履歴ごと完全削除。</li>
      </ul>
      <p className="text-sm font-bold mt-3">📬 内見予約承認待ち</p>
      <ul className="list-disc pl-6 mt-1 space-y-2 text-sm">
        <li>承認・鍵通知／キャンセル／却下／メール確認／🕓履歴（誰が・いつ・何を・前後の内容）／🗑削除。</li>
        <li>処理済みには「処理：担当者名／日時」を表示（旧データは「記録なし」）。</li>
      </ul>
      <p className="text-sm font-bold mt-3">🗓️ 内見カレンダー</p>
      <ul className="list-disc pl-6 mt-1 space-y-2 text-sm">
        <li>内見予約と手動予約を月／週／日で表示。手動予約の登録・日時変更・キャンセル・削除（重複チェック）。LINE WORKS同期。</li>
      </ul>

      <h3 className="text-base font-bold text-slate-700 mt-6">キーボックス管理台帳（/admin →「🔑キーボックス在庫」）</h3>
      <ul className="list-disc pl-6 mt-2 space-y-2 text-sm">
        <li>物件の鍵管理番号と社内KB番号マスタを照合し、各番号が今どこにあるかを一覧表示する。</li>
        <li>KB番号マスタ管理：自社KB番号の登録・廃止・削除。未登録番号は警告表示。</li>
        <li>集計タイル（クリックで一覧を絞り込み）：当社KB総数／社内在庫／物件使用中／回収待ち／重複使用／番号なし／他社所有。</li>
        <li>
          在庫一覧の列：KB番号／状態／物件名・住所／保管場所／解除番号／スリッパ／売り看板／最終更新／備考。
          <ul className="list-disc pl-6 mt-1 space-y-2">
            <li>状態：社内在庫／物件使用中／回収待ち／重複使用／未登録番号／番号なし／他社所有。</li>
            <li>解除番号は物件管理で登録した値が自動反映。番号未設定は「番号なし」として物件ごとに1行表示。</li>
            <li>各番号の「🕓履歴」で設置・変更・解除・回収の履歴を確認できる。</li>
          </ul>
        </li>
        <li>回収・返却待ち：自社KBは「回収完了」で保管場所を選び社内在庫へ、他社KB（金）は「返却完了」で記録のみ。「🗂 回収履歴」で戻し先を確認。</li>
      </ul>

      <h3 className="text-base font-bold text-slate-700 mt-6">自動記録・運用ルール</h3>
      <ul className="list-disc pl-6 mt-2 space-y-2 text-sm">
        <li>公開の優先順位：非公開／仕入決済前／売却済みは、いずれも仲介会社画面に表示されない。</li>
        <li>既存データは保護：売却済み化・各種処理は履歴・鍵情報・予約を削除しない（「削除」ボタンのみ完全削除）。</li>
        <li>操作者の自動記録：承認・却下・日時変更・キャンセル・削除・手動登録・回収/返却は、ログイン中のGoogleアカウントで自動記録される。</li>
        <li>ログイン：社内管理・キーボックス管理は @tokyomf.co.jp のGoogleアカウントが必要。</li>
      </ul>
    </div>
  );
}
