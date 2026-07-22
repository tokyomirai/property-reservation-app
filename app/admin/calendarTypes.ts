// 社内カレンダーで共有する型と配色。

export type CalendarCategory = '仲介会社内見' | '社内案内' | '仮予約' | 'キャンセル';

export interface CalendarEntry {
  id: string;
  kind: '内見予約' | '社内案内予約';
  category: CalendarCategory;
  propertyId: string;
  propertyName: string;
  date: string;
  startTime: string;
  endTime: string;
  companyName: string;
  personName: string;
  phone: string;
  mobilePhone: string;
  email: string;
  cardFileName: string;
  cardMimeType: string;
  hasCard: boolean;
  notes: string;
  status: string;
  createdAt: string;
}

/** 区分ごとの配色。カレンダー本体と凡例・詳細で共通に使う。 */
export const CATEGORY_COLORS: Record<
  CalendarCategory,
  { bg: string; dot: string; chip: string; label: string }
> = {
  仲介会社内見: {
    bg: '#2563eb',
    dot: 'bg-blue-600',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    label: '🔵 仲介会社内見',
  },
  社内案内: {
    bg: '#16a34a',
    dot: 'bg-green-600',
    chip: 'bg-green-50 text-green-700 border-green-200',
    label: '🟢 社内案内',
  },
  仮予約: {
    bg: '#f59e0b',
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    label: '🟠 仮予約（承認待ち）',
  },
  キャンセル: {
    bg: '#dc2626',
    dot: 'bg-red-600',
    chip: 'bg-red-50 text-red-700 border-red-200',
    label: '🔴 キャンセル',
  },
};

export const CATEGORY_ORDER: CalendarCategory[] = [
  '仲介会社内見',
  '社内案内',
  '仮予約',
  'キャンセル',
];
