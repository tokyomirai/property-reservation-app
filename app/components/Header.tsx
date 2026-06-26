'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = pathname?.startsWith('/admin');
  const isBroker = pathname?.startsWith('/broker');

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user ?? null);
      })
      .catch(() => setUser(null));
  }, [pathname]); // Refresh session check on route change

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleLogoutClick = () => {
    setIsDropdownOpen(false);
    window.location.href = '/api/auth/logout';
  };

  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              {/* Symbol mark image – place logo-mark.png in /public/ */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-mark.png.jpg"
                alt=""
                className="h-10 w-auto transition-transform group-hover:scale-[1.01]"
              />
              {/* Company name text matching the official logo typography */}
              <div className="flex flex-col leading-none">
                <span className="text-[11px] text-slate-500 font-semibold tracking-widest">株式会社</span>
                <span className="text-[18px] font-extrabold text-slate-900 tracking-tight leading-tight">東京みらい不動産</span>
              </div>
            </Link>
            <div className="hidden lg:block h-6 w-[1px] bg-slate-200 ml-2"></div>
            <span className="hidden lg:inline text-xs font-bold text-slate-500 ml-2">
              物件確認・内見受付・現況管理
            </span>
            {isAdmin && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 shadow-sm">
                社内管理
              </span>
            )}
            {isBroker && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm">
                仲介会社窓口
              </span>
            )}
          </div>

          {/* Controls & Profile Container */}
          <div className="flex items-center space-x-3">
            {/* Quick Roll Switcher */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-250/60 shadow-inner">
              <Link
                href="/admin"
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  isAdmin
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <span>🏢</span>
                <span>社内管理</span>
              </Link>
              <Link
                href="/broker"
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  isBroker
                    ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <span>🤝</span>
                <span>仲介会社向け</span>
              </Link>
            </div>

            {/* Profile Dropdown if logged in */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-center rounded-full border border-slate-250/80 p-0.5 hover:border-indigo-500 hover:shadow-sm focus:outline-none transition-all duration-200 cursor-pointer"
                  aria-label="ユーザーメニュー"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover shadow-inner"
                  />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2.5 w-60 bg-white border border-slate-200 rounded-xl shadow-lg py-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                    {/* User Profile Summary */}
                    <div className="px-4 py-2 border-b border-slate-100 pb-3 mb-1.5 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{user.name}</div>
                        <div className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">{user.email}</div>
                      </div>
                    </div>

                    {/* Navigation Links */}
                    <div className="space-y-0.5">
                      <Link
                        href="/admin"
                        onClick={() => setIsDropdownOpen(false)}
                        className={`flex items-center gap-2 w-full px-4 py-2 text-xs font-bold transition-colors ${
                          isAdmin
                            ? 'text-indigo-600 bg-indigo-50/50'
                            : 'text-slate-600 hover:text-slate-805 hover:bg-slate-50'
                        }`}
                      >
                        <span>🏢</span>
                        <span>社内管理画面</span>
                      </Link>
                      <Link
                        href="/"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-850 hover:bg-slate-50 transition-colors"
                      >
                        <span>🏠</span>
                        <span>ホームへ戻る</span>
                      </Link>
                    </div>

                    {/* Sign Out Button */}
                    <div className="border-t border-slate-100 mt-2 pt-2">
                      <button
                        onClick={handleLogoutClick}
                        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-bold text-rose-650 hover:bg-rose-50 transition-colors cursor-pointer text-left"
                      >
                        <span>🚪</span>
                        <span>ログアウト</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
