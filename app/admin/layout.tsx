'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';

// Google Logo SVG component
const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

const UserIcon = () => (
  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
  </svg>
);

const UserPlusIcon = () => (
  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
  </svg>
);

const WarningIcon = () => (
  <svg className="w-16 h-16 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
  </svg>
);

interface MockAccount {
  name: string;
  email: string;
  isCorporate: boolean;
  avatarColor: string;
}

const mockAccounts: MockAccount[] = [
  { name: '山田 太郎', email: 'taro.yamada@tokyomf.co.jp', isCorporate: true, avatarColor: 'bg-blue-600' },
  { name: '佐藤 花子', email: 'hanako.sato@tokyomf.co.jp', isCorporate: true, avatarColor: 'bg-emerald-600' },
  { name: '鈴木 一郎', email: 'ichiro.suzuki@gmail.com', isCorporate: false, avatarColor: 'bg-orange-600' },
  { name: '田中 健太', email: 'kenta.tanaka@tokyomf.co.jp', isCorporate: true, avatarColor: 'bg-indigo-600' },
];

type LoginScreenState = 'choose-account' | 'custom-email' | 'custom-name' | 'domain-blocked';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, login, logout, loading } = useAuth();
  const [screenState, setScreenState] = useState<LoginScreenState>('choose-account');
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [nameError, setNameError] = useState('');
  const [blockedEmail, setBlockedEmail] = useState('');

  // Handle edge case: if user is logged in with a non-corporate email (e.g. from an old session/storage hack)
  useEffect(() => {
    if (user && !user.email.endsWith('@tokyomf.co.jp')) {
      logout();
      setScreenState('choose-account');
    }
  }, [user, logout]);

  // Loading state spinner
  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center bg-slate-50 min-h-[70vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          </div>
          <span className="text-sm font-semibold text-slate-500">接続中...</span>
        </div>
      </div>
    );
  }

  // Render children if successfully logged in with correct domain
  if (user && user.email.endsWith('@tokyomf.co.jp')) {
    return <>{children}</>;
  }

  // --- Login Screen Handlers ---
  const handleAccountSelect = (account: MockAccount) => {
    if (account.isCorporate) {
      login(account.email, account.name);
    } else {
      setBlockedEmail(account.email);
      setScreenState('domain-blocked');
    }
  };

  const handleCustomEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    const email = customEmail.trim();
    if (!email) {
      setEmailError('メールアドレスを入力してください。');
      return;
    }

    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('有効なメールアドレスを入力してください。');
      return;
    }

    if (email.endsWith('@tokyomf.co.jp')) {
      setScreenState('custom-name');
    } else {
      setBlockedEmail(email);
      setScreenState('domain-blocked');
    }
  };

  const handleCustomNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameError('');

    const name = customName.trim();
    if (!name) {
      setNameError('名前を入力してください。');
      return;
    }

    login(customEmail.trim(), name);
  };

  const resetForm = () => {
    setScreenState('choose-account');
    setCustomEmail('');
    setCustomName('');
    setEmailError('');
    setNameError('');
    setBlockedEmail('');
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-slate-50 min-h-[85vh] px-4 py-12 select-none font-sans">
      
      {/* Sleek outer Google Sign-in Card */}
      <div className="w-full max-w-[450px] bg-white border border-slate-200 rounded-lg shadow-sm px-6 py-10 sm:px-10 sm:py-12 flex flex-col transition-all duration-300">
        
        {/* Logo and App Title */}
        <div className="flex flex-col items-center text-center space-y-4">
          <GoogleLogo />
          
          {screenState !== 'domain-blocked' ? (
            <>
              <h2 className="text-xl sm:text-2xl font-normal text-slate-900 tracking-tight">
                {screenState === 'choose-account' && 'アカウントの選択'}
                {screenState === 'custom-email' && 'ログイン'}
                {screenState === 'custom-name' && '登録の完了'}
              </h2>
              <p className="text-sm text-slate-650 font-medium">
                {screenState === 'custom-name' ? (
                  <span className="flex items-center gap-1.5 justify-center bg-slate-100 px-3 py-1 rounded-full text-slate-700 text-xs font-mono border border-slate-200">
                    📧 {customEmail}
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-slate-700">property-reservation-app</span> に進む
                  </>
                )}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center space-y-2 mt-2">
              <WarningIcon />
              <h2 className="text-lg sm:text-xl font-bold text-rose-600 mt-2">
                アクセスがブロックされました
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-semibold uppercase tracking-wider">
                組織外のアカウントです
              </p>
            </div>
          )}
        </div>

        {/* --- SCREEN 1: Account Chooser --- */}
        {screenState === 'choose-account' && (
          <div className="mt-8 flex-1 flex flex-col justify-between">
            <div className="divide-y divide-slate-150 border-t border-b border-slate-150">
              {mockAccounts.map((acc, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAccountSelect(acc)}
                  className="w-full flex items-center gap-3.5 py-3.5 px-2.5 hover:bg-slate-50 transition-colors text-left focus:outline-none focus:bg-slate-50 group"
                >
                  {/* Avatar Circle */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${acc.avatarColor} transition-transform group-hover:scale-105`}>
                    {acc.name.charAt(0)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <span>{acc.name}</span>
                      {acc.isCorporate && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-650 font-semibold border border-blue-200">
                          社内
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-medium truncate mt-0.5">{acc.email}</div>
                  </div>
                  {/* Arrow Indicator */}
                  <div className="text-slate-350 group-hover:text-slate-550 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </div>
                </button>
              ))}

              {/* Use Another Account Button */}
              <button
                onClick={() => setScreenState('custom-email')}
                className="w-full flex items-center gap-3.5 py-4 px-2.5 hover:bg-slate-50 transition-colors text-left focus:outline-none focus:bg-slate-50 group"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 group-hover:bg-blue-50 transition-colors">
                  <UserPlusIcon />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-blue-650 group-hover:text-blue-700 transition-colors">
                    別のアカウントを使用
                  </div>
                </div>
              </button>
            </div>
            
            <div className="mt-8 text-xs text-slate-400 text-center leading-relaxed font-medium">
              ※ デモ検証用: ＠tokyomf.co.jp ドメインのアカウントのみログイン可能です。gmail.com 等はアクセス制限されます。
            </div>
          </div>
        )}

        {/* --- SCREEN 2: Custom Email Form --- */}
        {screenState === 'custom-email' && (
          <form onSubmit={handleCustomEmailSubmit} className="mt-8 space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="relative">
                <input
                  type="text"
                  id="email-input"
                  className={`w-full bg-white border ${
                    emailError ? 'border-rose-500 focus:border-rose-500' : 'border-slate-300 focus:border-blue-600'
                  } rounded px-3 py-3.5 text-sm text-slate-800 focus:outline-none placeholder-transparent peer transition-colors`}
                  placeholder="メールアドレス"
                  value={customEmail}
                  onChange={(e) => {
                    setCustomEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  autoFocus
                />
                <label
                  htmlFor="email-input"
                  className={`absolute left-3 ${
                    emailError ? 'text-rose-500 peer-focus:text-rose-500' : 'text-slate-500 peer-focus:text-blue-600'
                  } text-xs -top-2 bg-white px-1 font-medium transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-slate-400 peer-focus:-top-2 peer-focus:text-xs pointer-events-none`}
                >
                  メールアドレス
                </label>
                
                {/* Email Verification Error Message */}
                {emailError && (
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-rose-600">
                    <span>⚠️</span>
                    <span>{emailError}</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 leading-relaxed font-medium">
                ご自身のGoogleアカウントのメールアドレス（テスト用: <strong>@tokyomf.co.jp</strong> ドメイン）を入力してください。
              </div>
            </div>

            <div className="flex items-center justify-between pt-6">
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors focus:outline-none"
              >
                戻る
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all focus:outline-none"
              >
                次へ
              </button>
            </div>
          </form>
        )}

        {/* --- SCREEN 3: Custom Name Form --- */}
        {screenState === 'custom-name' && (
          <form onSubmit={handleCustomNameSubmit} className="mt-8 space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="relative">
                <input
                  type="text"
                  id="name-input"
                  className={`w-full bg-white border ${
                    nameError ? 'border-rose-500 focus:border-rose-500' : 'border-slate-300 focus:border-blue-600'
                  } rounded px-3 py-3.5 text-sm text-slate-800 focus:outline-none placeholder-transparent peer transition-colors`}
                  placeholder="お名前"
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  autoFocus
                />
                <label
                  htmlFor="name-input"
                  className={`absolute left-3 ${
                    nameError ? 'text-rose-500 peer-focus:text-rose-500' : 'text-slate-500 peer-focus:text-blue-600'
                  } text-xs -top-2 bg-white px-1 font-medium transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-slate-400 peer-focus:-top-2 peer-focus:text-xs pointer-events-none`}
                >
                  お名前 (表示名)
                </label>
                
                {nameError && (
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-rose-600">
                    <span>⚠️</span>
                    <span>{nameError}</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 leading-relaxed font-medium">
                社内管理画面に表示するお名前（例: 山田 太郎）を入力してください。
              </div>
            </div>

            <div className="flex items-center justify-between pt-6">
              <button
                type="button"
                onClick={() => setScreenState('custom-email')}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors focus:outline-none"
              >
                戻る
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all focus:outline-none"
              >
                ログイン
              </button>
            </div>
          </form>
        )}

        {/* --- SCREEN 4: Access Blocked / Domain Policy Error --- */}
        {screenState === 'domain-blocked' && (
          <div className="mt-8 flex-1 flex flex-col justify-between space-y-6">
            <div className="bg-rose-50 border border-rose-150 rounded-lg p-5 text-slate-700 text-sm leading-relaxed space-y-3 shadow-inner">
              <p className="font-bold text-slate-900 text-xs sm:text-sm">
                組織外のGoogleアカウントであるため、このアプリケーションへのアクセスは制限されています。
              </p>
              <p className="text-xs text-slate-550">
                本システムは、<strong>東京みらい不動産</strong> の関係者専用のプライベートツールです。
                ログインするには、組織ドメイン（<span className="font-mono bg-slate-100 px-1 rounded font-bold">@tokyomf.co.jp</span>）のGoogleアカウントを選択するか、入力してください。
              </p>
              <div className="pt-2 border-t border-rose-200/60 text-xs font-mono text-slate-500">
                ブロックされたアカウント: <span className="font-semibold break-all">{blockedEmail}</span>
              </div>
            </div>

            <button
              onClick={resetForm}
              className="w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 text-sm font-bold shadow-sm transition-all text-center focus:outline-none"
            >
              アカウントの選択に戻る
            </button>
          </div>
        )}

      </div>

      {/* Mock Google footer */}
      <div className="w-full max-w-[450px] flex items-center justify-between mt-6 px-2 text-xs text-slate-400">
        <div>
          <span>日本語</span>
        </div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-slate-600">ヘルプ</a>
          <a href="#" className="hover:text-slate-600">プライバシー</a>
          <a href="#" className="hover:text-slate-600">規約</a>
        </div>
      </div>

    </div>
  );
}
