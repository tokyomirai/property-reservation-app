export interface Property {
  id: string;
  name: string;
  address: string;
  salesStatus: '販売中' | '申込あり' | '契約予定' | '契約済' | '募集停止中';
  viewingStatus: '内見可能' | '日程調整' | 'リフォーム中' | '内見不可';
  hasKeyBox: 'あり' | 'なし' | '';
  keyBoxNumber: string; // 管理番号（①②等の簡易番号）
  unlockCode: string;
  setupLocation: string;
  hasSlippers: 'あり' | 'なし' | '';
  hasSignboard: 'あり' | 'なし' | '';
  notes: string;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

export interface Reservation {
  id: string;
  propertyId: string;
  propertyName: string;
  companyName: string;
  agentName: string;
  phone: string;
  email: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
  status: '未承認' | '承認済' | '却下';
  createdAt: string;
}

const initialProperties: Property[] = [
  {
    id: 'prop-1',
    name: '千代田ファーストビル 701号室',
    address: '東京都千代田区麹町1-2-3',
    salesStatus: '販売中',
    viewingStatus: '内見可能',
    hasKeyBox: 'あり',
    keyBoxNumber: '1',
    unlockCode: '5521',
    setupLocation: '玄関扉横のメーターボックス内',
    hasSlippers: 'あり',
    hasSignboard: 'なし',
    notes: '室内クリーニング済み。即案内可能です。スリッパは室内玄関に設置してあります。',
    lastUpdatedBy: '山田 太郎',
    lastUpdatedAt: '2026-06-10 14:30',
  },
  {
    id: 'prop-2',
    name: '恵比寿サウスレジデンス 305号室',
    address: '東京都渋谷区恵比寿南2-5-5',
    salesStatus: '申込あり',
    viewingStatus: '日程調整',
    hasKeyBox: 'あり',
    keyBoxNumber: '2',
    unlockCode: '', // 未入力にして警告対象にする
    setupLocation: '', // 未入力にして警告対象にする
    hasSlippers: 'なし', // 未入力ではないが「なし」
    hasSignboard: 'なし',
    notes: '現在2番手の内見予約のみ受け付けております。日程は事前調整が必要です。',
    lastUpdatedBy: '鈴木 一郎',
    lastUpdatedAt: '2026-06-11 11:15',
  },
  {
    id: 'prop-3',
    name: 'レジディア新宿 1202号室',
    address: '東京都新宿区西新宿3-10-1',
    salesStatus: '販売中',
    viewingStatus: 'リフォーム中',
    hasKeyBox: '', // 未設定にして警告対象にする
    keyBoxNumber: '',
    unlockCode: '',
    setupLocation: '',
    hasSlippers: '', // 未設定にして警告対象にする
    hasSignboard: '', // 未設定にして警告対象にする
    notes: '現在クロス貼り替え工事中 (6/20完了予定)。工事中につき内見時はヘルメットを着用してください。',
    lastUpdatedBy: '田中 次郎',
    lastUpdatedAt: '2026-06-12 09:00',
  }
];

const initialReservations: Reservation[] = [
  {
    id: 'R-10001',
    propertyId: 'prop-2',
    propertyName: '恵比寿サウスレジデンス 305号室',
    companyName: 'ABC不動産',
    agentName: '佐藤 健',
    phone: '090-1234-5678',
    email: 'sato@abc-realestate.co.jp',
    preferredDate: '2026-06-15',
    preferredTime: '13:00〜14:00',
    notes: 'お客様同伴で現地にて直行直帰で内見希望です。',
    status: '未承認',
    createdAt: '2026-06-12 10:00',
  }
];

const STORAGE_KEYS = {
  PROPERTIES: 'antigravity_properties_v2',
  RESERVATIONS: 'antigravity_reservations_v2',
};

// クライアントサイドでのみ実行されることを保証するヘルパー
const isClient = typeof window !== 'undefined';

export function initializeData(force = false) {
  if (!isClient) return;

  if (force || !localStorage.getItem(STORAGE_KEYS.PROPERTIES)) {
    localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(initialProperties));
  }
  if (force || !localStorage.getItem(STORAGE_KEYS.RESERVATIONS)) {
    localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(initialReservations));
  }
}

export function getProperties(): Property[] {
  if (!isClient) return [];
  initializeData();
  const data = localStorage.getItem(STORAGE_KEYS.PROPERTIES);
  return data ? JSON.parse(data) : [];
}

export function saveProperties(properties: Property[]) {
  if (!isClient) return;
  localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
}

export function getReservations(): Reservation[] {
  if (!isClient) return [];
  initializeData();
  const data = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
  return data ? JSON.parse(data) : [];
}

export function saveReservations(reservations: Reservation[]) {
  if (!isClient) return;
  localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(reservations));
}

export function addReservation(reservation: Omit<Reservation, 'id' | 'status' | 'createdAt'>): Reservation {
  const reservations = getReservations();
  const newId = `R-${Math.floor(10000 + Math.random() * 90000)}`;
  
  // 今日の日時を取得
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const newReservation: Reservation = {
    ...reservation,
    id: newId,
    status: '未承認',
    createdAt: formattedDate,
  };
  
  reservations.unshift(newReservation);
  saveReservations(reservations);
  return newReservation;
}

export function updateProperty(property: Property) {
  const properties = getProperties();
  const index = properties.findIndex(p => p.id === property.id);
  
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const updatedProperty = {
    ...property,
    lastUpdatedAt: formattedDate,
  };

  if (index !== -1) {
    properties[index] = updatedProperty;
  } else {
    properties.push(updatedProperty);
  }
  saveProperties(properties);
  return updatedProperty;
}

export function updateReservationStatus(id: string, status: '未承認' | '承認済' | '却下'): Reservation | null {
  const reservations = getReservations();
  const index = reservations.findIndex(r => r.id === id);
  if (index !== -1) {
    reservations[index].status = status;
    saveReservations(reservations);
    return reservations[index];
  }
  return null;
}
