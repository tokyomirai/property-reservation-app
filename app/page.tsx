'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col justify-center items-center px-4 py-16 bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Title / Hero */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-855">
            <span className="block text-slate-900">東京みらい不動産</span>
            <span className="block mt-2 bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent text-2xl sm:text-3.5xl font-bold">
              物件確認・内見受付・現況管理システム
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-505 leading-relaxed">
            本システムは、仲介会社様向けの物件確認および内見予約の受付業務と、
            社内の現地備品・鍵管理および販売状況管理を一元化するための統合システムです。
          </p>
        </div>

        {/* Portals Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto mt-12">
          {/* Internal Portal */}
          <div className="group relative rounded-2xl border border-slate-200 bg-white p-8 hover:bg-slate-50/50 transition-all duration-300 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5 flex flex-col justify-between text-left shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl">🏢</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-150">
                  社内メンバー専用
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors duration-200">
                社内管理画面 (営業用)
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                物件の販売状況・内見可否、現地備品（スリッパ・看板）、キーボックスの設置状況を一括管理します。
                未入力項目の警告表示や、仲介会社からの内見予約の確認・承認もこちらから行います。
              </p>
            </div>
            <Link href="/admin" className="mt-8 block w-full text-center px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/10 transition-all duration-200 hover:-translate-y-0.5">
              管理画面に入る
            </Link>
          </div>

          {/* Broker Portal */}
          <div className="group relative rounded-2xl border border-slate-200 bg-white p-8 hover:bg-slate-50/50 transition-all duration-300 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5 flex flex-col justify-between text-left shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl">🤝</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-150">
                  仲介業者様向け
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-800 group-hover:text-emerald-600 transition-colors duration-200">
                物件確認・内見予約窓口
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                現在の販売状況や内見可否状況をリアルタイムで確認し、内見予約をお申込みいただけます。
                キーボックスや解除番号などの重要情報は、承認後にのみ安全に開示されます。
              </p>
            </div>
            <Link href="/broker" className="mt-8 block w-full text-center px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 hover:opacity-95 text-white font-bold text-sm shadow-md shadow-emerald-500/10 transition-all duration-200 hover:-translate-y-0.5">
              物件状況を確認する
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
