'use client';

import { useState, useEffect } from 'react';
import {
  Property,
  Reservation,
  getProperties,
  saveProperties,
  getReservations,
  updateProperty,
  updateReservationStatus,
  initializeData
} from '../../utils/mockData';

export default function AdminPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeTab, setActiveTab] = useState<'properties' | 'reservations'>('properties');
  
  // モーダル・編集状態
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedReservationForMail, setSelectedReservationForMail] = useState<Reservation | null>(null);

  // 新規登録フォーム用State
  const [newProp, setNewProp] = useState<Omit<Property, 'id' | 'lastUpdatedAt'>>({
    name: '',
    address: '',
    salesStatus: '販売中',
    viewingStatus: '内見可能',
    hasKeyBox: '',
    keyBoxNumber: '',
    unlockCode: '',
    setupLocation: '',
    hasSlippers: '',
    hasSignboard: '',
    notes: '',
    lastUpdatedBy: ''
  });

  // データ読み込み
  useEffect(() => {
    initializeData();
    setProperties(getProperties());
    setReservations(getReservations());
  }, []);

  const refreshData = () => {
    setProperties(getProperties());
    setReservations(getReservations());
  };

  const handleResetData = () => {
    if (confirm('デモデータを初期状態にリセットしますか？')) {
      initializeData(true);
      refreshData();
    }
  };

  // 物件アラート判定
  const getPropertyAlerts = (prop: Property) => {
    const alerts: string[] = [];
    if (!prop.hasKeyBox) {
      alerts.push('キーボックス未設定');
    } else if (prop.hasKeyBox === 'あり') {
      if (!prop.keyBoxNumber.trim()) alerts.push('キーボックス番号未入力');
      if (!prop.unlockCode.trim()) alerts.push('鍵解除番号未入力');
      if (!prop.setupLocation.trim()) alerts.push('鍵設置場所未入力');
    }
    if (!prop.hasSlippers) {
      alerts.push('スリッパ未設定');
    }
    if (!prop.hasSignboard) {
      alerts.push('売り看板未設定');
    }
    return alerts;
  };

  // 物件登録処理
  const handleAddPropertySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProp.name || !newProp.address || !newProp.lastUpdatedBy) {
      alert('物件名、住所、最終更新者は必須項目です。');
      return;
    }

    const newProperty: Property = {
      ...newProp,
      id: `prop-${Date.now()}`,
      lastUpdatedAt: ''
    } as Property;

    updateProperty(newProperty);
    refreshData();
    
    // フォーム初期化
    setNewProp({
      name: '',
      address: '',
      salesStatus: '販売中',
      viewingStatus: '内見可能',
      hasKeyBox: '',
      keyBoxNumber: '',
      unlockCode: '',
      setupLocation: '',
      hasSlippers: '',
      hasSignboard: '',
      notes: '',
      lastUpdatedBy: ''
    });
    setIsAddModalOpen(false);
  };

  // 物件更新処理
  const handleEditPropertySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;
    if (!editingProperty.name || !editingProperty.address || !editingProperty.lastUpdatedBy) {
      alert('物件名、住所、最終更新者は必須項目です。');
      return;
    }

    updateProperty(editingProperty);
    refreshData();
    setEditingProperty(null);
  };

  // 予約ステータス更新 (承認/却下)
  const handleUpdateStatus = (resId: string, status: '承認済' | '却下') => {
    const updated = updateReservationStatus(resId, status);
    refreshData();
    
    if (status === '承認済' && updated) {
      setSelectedReservationForMail(updated);
    }
  };

  const getPropertyForReservation = (propertyId: string) => {
    return properties.find(p => p.id === propertyId);
  };

  return (
    <div className="flex-1 bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Title & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span>🏢</span> 物件現況・内見受付管理
            </h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              社内の鍵・備品の管理と、仲介会社からの内見予約をコントロールします。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetData}
              className="px-3.5 py-2 rounded-lg bg-white border border-slate-250 hover:bg-slate-50 text-slate-600 text-xs font-bold shadow-sm transition-colors"
            >
              🔄 デモデータ初期化
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/10 transition-all duration-200"
            >
              ➕ 新規物件登録
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-2 shadow-sm">
          <button
            onClick={() => setActiveTab('properties')}
            className={`px-5 py-4 text-sm font-bold border-b-2 transition-all duration-200 ${
              activeTab === 'properties'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            📋 物件管理（現況・備品）
            {properties.some(p => getPropertyAlerts(p).length > 0) && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-600 text-white">
                !
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reservations')}
            className={`px-5 py-4 text-sm font-bold border-b-2 transition-all duration-200 ${
              activeTab === 'reservations'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            📬 内見予約承認待ち
            {reservations.filter(r => r.status === '未承認').length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-900">
                {reservations.filter(r => r.status === '未承認').length}
              </span>
            )}
          </button>
        </div>

        {/* 1. 物件管理タブ */}
        {activeTab === 'properties' && (
          <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">物件名 / 住所</th>
                    <th className="px-4 py-4">販売状況</th>
                    <th className="px-4 py-4">内見状況</th>
                    <th className="px-4 py-4">鍵管理</th>
                    <th className="px-4 py-4">スリッパ</th>
                    <th className="px-4 py-4">売り看板</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {properties.map((prop) => {
                    const alerts = getPropertyAlerts(prop);
                    const hasAlert = alerts.length > 0;
                    return (
                      <tr 
                        key={prop.id} 
                        className={`hover:bg-slate-50/50 transition-colors ${
                          hasAlert ? 'bg-rose-500/[0.02] hover:bg-rose-500/[0.04]' : ''
                        }`}
                      >
                        {/* 物件名 / 住所 */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{prop.name}</div>
                          <div className="text-slate-500 text-xs mt-0.5">📍 {prop.address}</div>
                          {/* 未入力アラートリスト */}
                          {hasAlert && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {alerts.map((al, idx) => (
                                <span 
                                  key={idx} 
                                  className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white animate-pulse shadow-sm"
                                >
                                  ⚠️ {al}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* 販売状況 */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            prop.salesStatus === '販売中' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                            prop.salesStatus === '申込あり' ? 'bg-amber-50 text-amber-700 border border-amber-250' :
                            prop.salesStatus === '契約予定' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                            prop.salesStatus === '契約済' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {prop.salesStatus}
                          </span>
                        </td>

                        {/* 内見状況 */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            prop.viewingStatus === '内見可能' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            prop.viewingStatus === '日程調整' ? 'bg-amber-50 text-amber-700 border border-amber-250' :
                            prop.viewingStatus === 'リフォーム中' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {prop.viewingStatus}
                          </span>
                        </td>

                        {/* 鍵管理 */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {!prop.hasKeyBox ? (
                            <span className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-bold animate-pulse shadow-sm">
                              ⚠️ 未設定
                            </span>
                          ) : prop.hasKeyBox === 'あり' ? (
                            <div className="space-y-0.5 text-xs">
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold inline-block mb-1">
                                KBあり
                              </span>
                              {prop.unlockCode ? (
                        <div className="text-slate-700 font-mono font-semibold">管理番号: {prop.keyBoxNumber} / 解除: {prop.unlockCode}</div>
                              ) : (
                                <div className="text-rose-600 font-extrabold animate-pulse">❌ 解除番号未入力</div>
                              )}
                              {prop.setupLocation ? (
                                <div className="text-slate-500 text-[11px] truncate max-w-[150px]">{prop.setupLocation}</div>
                              ) : (
                                <div className="text-rose-600 font-extrabold animate-pulse">❌ 設置場所未入力</div>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs">
                              なし
                            </span>
                          )}
                        </td>

                        {/* スリッパ */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {prop.hasSlippers === '' ? (
                            <span className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-bold animate-pulse shadow-sm">
                              ⚠️ 未設定
                            </span>
                          ) : prop.hasSlippers === 'あり' ? (
                            <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                              あり
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-500 text-xs">
                              なし
                            </span>
                          )}
                        </td>

                        {/* 売り看板 */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {prop.hasSignboard === '' ? (
                            <span className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-bold animate-pulse shadow-sm">
                              ⚠️ 未設定
                            </span>
                          ) : prop.hasSignboard === 'あり' ? (
                            <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                              あり
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-500 text-xs">
                              なし
                            </span>
                          )}
                        </td>

                        {/* 操作 */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                          <button
                            onClick={() => setEditingProperty(prop)}
                            className="px-3.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 transition-colors font-bold shadow-sm"
                          >
                            現況更新
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. 内見予約承認待ちタブ */}
        {activeTab === 'reservations' && (
          <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">申込日時</th>
                    <th className="px-6 py-4">対象物件</th>
                    <th className="px-6 py-4">仲介業者 / 担当者</th>
                    <th className="px-6 py-4">内見希望日時</th>
                    <th className="px-6 py-4">ステータス</th>
                    <th className="px-6 py-4 text-right">アクション</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {reservations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        現在届いている内見予約申込みはありません。
                      </td>
                    </tr>
                  ) : (
                    reservations.map((res) => {
                      const prop = getPropertyForReservation(res.propertyId);
                      return (
                        <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-555 font-medium">
                            {res.createdAt}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{res.propertyName}</div>
                            <div className="text-xs text-slate-500 mt-1 font-mono">ID: {res.id}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{res.companyName}</div>
                            <div className="text-slate-600 text-xs mt-0.5">{res.agentName} 様</div>
                            <div className="text-slate-500 text-xs font-mono">{res.phone} | {res.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-slate-800 font-bold">{res.preferredDate}</div>
                            <div className="text-slate-500 text-xs">{res.preferredTime}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              res.status === '承認済' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              res.status === '未承認' ? 'bg-amber-50 text-amber-700 border border-amber-250' :
                              'bg-rose-50 text-rose-750 border border-rose-200'
                            }`}>
                              {res.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs space-x-2">
                            {res.status === '未承認' ? (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(res.id, '承認済')}
                                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm transition-colors"
                                >
                                  承認・鍵通知
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(res.id, '却下')}
                                  className="px-3 py-1.5 rounded bg-white hover:bg-slate-50 text-slate-600 border border-slate-250 shadow-sm transition-colors"
                                >
                                  却下
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setSelectedReservationForMail(res)}
                                className="px-2.5 py-1.5 rounded bg-white hover:bg-slate-50 text-indigo-600 border border-slate-250 shadow-sm transition-colors font-bold"
                              >
                                ✉️ メール確認
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* --- モーダル: 新規物件登録 --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">🏢 新規物件の登録</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddPropertySubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">物件名 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="例：渋谷ファーストレジデンス 502号室"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={newProp.name}
                    onChange={e => setNewProp({...newProp, name: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">住所 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="例：東京都渋谷区宇田川町1-1"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={newProp.address}
                    onChange={e => setNewProp({...newProp, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">販売状況</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={newProp.salesStatus}
                    onChange={e => setNewProp({...newProp, salesStatus: e.target.value as any})}
                  >
                    <option value="販売中">販売中</option>
                    <option value="申込あり">申込あり</option>
                    <option value="契約予定">契約予定</option>
                    <option value="契約済">契約済</option>
                    <option value="募集停止中">募集停止中</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">内見状況</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={newProp.viewingStatus}
                    onChange={e => setNewProp({...newProp, viewingStatus: e.target.value as any})}
                  >
                    <option value="内見可能">内見可能</option>
                    <option value="日程調整">日程調整</option>
                    <option value="リフォーム中">リフォーム中</option>
                    <option value="内見不可">内見不可</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-4">
                <h4 className="text-sm font-bold text-indigo-600 flex items-center gap-1.5">🔑 鍵・キーボックス管理</h4>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">キーボックス設置</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={newProp.hasKeyBox}
                    onChange={e => setNewProp({...newProp, hasKeyBox: e.target.value as any})}
                  >
                    <option value="">-- 未選択 --</option>
                    <option value="あり">あり</option>
                    <option value="なし">なし</option>
                  </select>
                </div>

                {newProp.hasKeyBox === 'あり' && (
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-550 uppercase mb-1">キーボックス管理番号</label>
                      <input
                        type="text"
                        placeholder="例：1、2、3..."
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        value={newProp.keyBoxNumber}
                        onChange={e => setNewProp({...newProp, keyBoxNumber: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-550 uppercase mb-1">解除番号</label>
                      <input
                        type="text"
                        placeholder="例：4920"
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        value={newProp.unlockCode}
                        onChange={e => setNewProp({...newProp, unlockCode: e.target.value})}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-slate-550 uppercase mb-1">設置場所</label>
                      <input
                        type="text"
                        placeholder="例：1F集合ポストの裏"
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        value={newProp.setupLocation}
                        onChange={e => setNewProp({...newProp, setupLocation: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <h4 className="text-sm font-bold text-indigo-600 mb-2">📦 現地備品</h4>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">スリッパ設置</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={newProp.hasSlippers}
                    onChange={e => setNewProp({...newProp, hasSlippers: e.target.value as any})}
                  >
                    <option value="">-- 未選択 --</option>
                    <option value="あり">あり</option>
                    <option value="なし">なし</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">売り看板設置</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={newProp.hasSignboard}
                    onChange={e => setNewProp({...newProp, hasSignboard: e.target.value as any})}
                  >
                    <option value="">-- 未選択 --</option>
                    <option value="あり">あり</option>
                    <option value="なし">なし</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">備考</label>
                  <textarea
                    rows={2}
                    placeholder="仲介会社へも見せたい案内事項を入力"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={newProp.notes}
                    onChange={e => setNewProp({...newProp, notes: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">最終更新者 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="ご自身の名前"
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={newProp.lastUpdatedBy}
                    onChange={e => setNewProp({...newProp, lastUpdatedBy: e.target.value})}
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md"
                >
                  登録する
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm border border-slate-250"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- モーダル: 物件の現況更新 (編集) --- */}
      {editingProperty && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">📝 物件現況の更新</h3>
              <button 
                onClick={() => setEditingProperty(null)}
                className="text-slate-400 hover:text-slate-650 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleEditPropertySubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  ID: {editingProperty.id}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">物件名 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={editingProperty.name}
                    onChange={e => setEditingProperty({...editingProperty, name: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">住所 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={editingProperty.address}
                    onChange={e => setEditingProperty({...editingProperty, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">販売状況</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={editingProperty.salesStatus}
                    onChange={e => setEditingProperty({...editingProperty, salesStatus: e.target.value as any})}
                  >
                    <option value="販売中">販売中</option>
                    <option value="申込あり">申込あり</option>
                    <option value="契約予定">契約予定</option>
                    <option value="契約済">契約済</option>
                    <option value="募集停止中">募集停止中</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">内見状況</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={editingProperty.viewingStatus}
                    onChange={e => setEditingProperty({...editingProperty, viewingStatus: e.target.value as any})}
                  >
                    <option value="内見可能">内見可能</option>
                    <option value="日程調整">日程調整</option>
                    <option value="リフォーム中">リフォーム中</option>
                    <option value="内見不可">内見不可</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-4">
                <h4 className="text-sm font-bold text-indigo-600 flex items-center gap-1.5">🔑 鍵・キーボックス管理</h4>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">キーボックス設置</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={editingProperty.hasKeyBox}
                    onChange={e => setEditingProperty({...editingProperty, hasKeyBox: e.target.value as any})}
                  >
                    <option value="">-- 未選択 --</option>
                    <option value="あり">あり</option>
                    <option value="なし">なし</option>
                  </select>
                </div>

                {editingProperty.hasKeyBox === 'あり' && (
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-550 uppercase mb-1">キーボックス管理番号</label>
                      <input
                        type="text"
                        placeholder="例：1、2、3..."
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        value={editingProperty.keyBoxNumber}
                        onChange={e => setEditingProperty({...editingProperty, keyBoxNumber: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-550 uppercase mb-1">解除番号</label>
                      <input
                        type="text"
                        placeholder="4桁の数字など"
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        value={editingProperty.unlockCode}
                        onChange={e => setEditingProperty({...editingProperty, unlockCode: e.target.value})}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-slate-550 uppercase mb-1">設置場所</label>
                      <input
                        type="text"
                        placeholder="例：玄関ドア横パイプスペース内"
                        className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        value={editingProperty.setupLocation}
                        onChange={e => setEditingProperty({...editingProperty, setupLocation: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <h4 className="text-sm font-bold text-indigo-600 mb-2">📦 現地備品</h4>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">スリッパ設置</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={editingProperty.hasSlippers}
                    onChange={e => setEditingProperty({...editingProperty, hasSlippers: e.target.value as any})}
                  >
                    <option value="">-- 未選択 --</option>
                    <option value="あり">あり</option>
                    <option value="なし">なし</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">売り看板設置</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={editingProperty.hasSignboard}
                    onChange={e => setEditingProperty({...editingProperty, hasSignboard: e.target.value as any})}
                  >
                    <option value="">-- 未選択 --</option>
                    <option value="あり">あり</option>
                    <option value="なし">なし</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">備考</label>
                  <textarea
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={editingProperty.notes}
                    onChange={e => setEditingProperty({...editingProperty, notes: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">最終更新者 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    value={editingProperty.lastUpdatedBy}
                    onChange={e => setEditingProperty({...editingProperty, lastUpdatedBy: e.target.value})}
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md"
                >
                  保存する
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProperty(null)}
                  className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm border border-slate-250"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- モーダル: 自動送信メールシミュレーター --- */}
      {selectedReservationForMail && (() => {
        const prop = getPropertyForReservation(selectedReservationForMail.propertyId);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-emerald-600 flex items-center gap-2">
                  <span>✉️</span> 自動メール送信シミュレーター
                </h3>
                <button 
                  onClick={() => setSelectedReservationForMail(null)}
                  className="text-slate-400 hover:text-slate-650 text-2xl font-bold"
                >
                  &times;
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-500 font-medium">
                  ※ 内見承認が完了しました。システムより仲介業者様宛に以下のメールが自動送信されています。
                </p>

                <div className="bg-slate-950 border border-slate-900 rounded-lg p-4 font-mono text-xs text-slate-350 space-y-3 shadow-inner">
                  <div>
                    <span className="text-slate-500">件名:</span> <span className="text-slate-100 font-bold">【内見確定】内見のご案内と鍵情報のお知らせ（東京みらい不動産）</span>
                  </div>
                  <div>
                    <span className="text-slate-500">宛先:</span> <span className="text-indigo-400 font-bold">{selectedReservationForMail.email}</span> ({selectedReservationForMail.companyName} {selectedReservationForMail.agentName}様)
                  </div>
                  <div className="border-t border-slate-800 pt-3 text-slate-300 whitespace-pre-wrap leading-relaxed">
{`${selectedReservationForMail.companyName}
${selectedReservationForMail.agentName} 様

いつも大変お世話になっております。
東京みらい不動産でございます。

お申込みいただきました下記物件の内見希望につきまして、以下の通りご案内を確定いたしました。
現地キーボックスの解除番号、設置場所をお知らせいたします。

■ 内見概要
【物件名】 ${selectedReservationForMail.propertyName}
【日時】 ${selectedReservationForMail.preferredDate} ${selectedReservationForMail.preferredTime}

■ 鍵情報（キーボックス解除番号）
${prop?.hasKeyBox === 'あり' ? `【キーボックス番号】 ${prop.keyBoxNumber || '未設定'}
【解除番号】 ${prop.unlockCode || '未設定'}
【設置場所】 ${prop.setupLocation || '未設定'}` : '【鍵の受渡】 キーボックスはございません。社内管理画面より受渡方法をご確認ください。'}

■ 注意事項
・内見終了後は、必ずキーボックスに鍵を戻し、ダイヤルをランダムに回して施錠を確認してください。
・電気・エアコンをご利用になった場合は、退室時に必ず消灯・停止してください。
・現地備品（スリッパ・売り看板など）は持ち出さないようお願いいたします。

よろしくお願い申し上げます。
--------------------------------------------------
東京みらい不動産 営業部
東京都千代田区丸の内1-1-1
--------------------------------------------------`}
                  </div>
                </div>

                <div className="text-right">
                  <button
                    onClick={() => setSelectedReservationForMail(null)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs tracking-wide shadow-sm"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
