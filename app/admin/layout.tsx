'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface SessionUser {
  email: string;
  name: string;
  picture: string;
}

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

function LoginScreen({ errorType, blockedEmail }: { errorType: string | null; blockedEmail: string | null }) {
  const isDomainError = errorType === 'domain_mismatch';
  const isServerError = errorType && !isDomainError && errorType !== 'cancelled';

  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-slate-50 min-h-[85vh] px-4 py-12">
      <div className="w-full max-w-[420px] bg-white border border-slate-200 rounded-xl shadow-sm px-8 py-10 flex flex-col items-center text-center space-y-6">

        {/* ロゴ */}
        <div className="flex flex-col items-center space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png.jpg" alt="東京みらい不動産" className="h-12 w-auto" />
          <div>
            <div className="text-[11px] text-slate-500 font-semibold tracking-widest">株式会社</div>
            <div className="text-lg font-extrabold text-slate-900 tracking-tight">東京みらい不動産</div>
          </div>
        </div>

        <div className="w-full h-px bg-slate-200" />

        {/* エラー表示 */}
        {isDomainError && (
          <div className="w-full bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-left space-y-1">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <span>⚠️</span>
              <span>アクセス制限エラー</span>
            </div>
            <p className="text-xs text-rose-600 leading-relaxed">
              このシステムは東京みらい不動産（<span className="font-mono font-bold">@tokyomf.co.jp</span>）の社員専用です。
              {blockedEmail && (
                <span className="block mt-1 font-mono text-[11px] text-rose-500 break-all">
                  試行アカウント: {blockedEmail}
                </span>
              )}
            </p>
          </div>
        )}

        {isServerError && (
          <div className="w-full bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-left">
            <p className="text-xs text-amber-700 font-medium">
              ログイン処理中にエラーが発生しました。再度お試しください。
            </p>
          </div>
        )}

        {/* ログインボタン */}
        <div className="w-full space-y-3">
          <p className="text-sm text-slate-600 font-medium">社内管理システム</p>
          <a
            href="/api/auth/login"
            className="flex items-center justify-center gap-3 w-full px-5 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-700 font-semibold text-sm shadow-sm transition-all duration-200 hover:shadow-md"
          >
            <GoogleLogo />
            Googleアカウントでサインイン
          </a>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            @tokyomf.co.jp のGoogleアカウントのみログイン可能です
          </p>
        </div>
      </div>

      {/* フッター */}
      <div className="mt-6 text-[11px] text-slate-400 text-center">
        © 株式会社東京みらい不動産 - 社内システム
      </div>
    </div>
  );
}

function LoginScreenWrapper() {
  const searchParams = useSearchParams();
  const errorType = searchParams.get('error');
  const blockedEmail = searchParams.get('email');
  return <LoginScreen errorType={errorType} blockedEmail={blockedEmail} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center min-h-[70vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
          </div>
          <span className="text-sm font-medium text-slate-500">確認中...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <React.Suspense fallback={null}>
        <LoginScreenWrapper />
      </React.Suspense>
    );
  }

  return <>{children}</>;
}
