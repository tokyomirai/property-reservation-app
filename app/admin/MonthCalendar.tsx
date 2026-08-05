'use client';

// FullCalendar を用いた月／週／日表示。ブラウザAPIに依存するため
// CalendarTab から ssr:false で動的に読み込む。

import { useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import jaLocale from '@fullcalendar/core/locales/ja';
import type { EventClickArg, EventInput, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import type { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import { CATEGORY_COLORS, type CalendarEntry } from './calendarTypes';

interface Props {
  entries: CalendarEntry[];
  /** 予定をクリックしたとき */
  onSelectEntry: (entry: CalendarEntry) => void;
  /** 日付のマスをクリックしたとき（その日の一覧を開く） */
  onSelectDate: (date: string) => void;
  /** ドラッグで時間帯を選択したとき（新規登録フォームを開く） */
  onSelectRange: (date: string, startTime: string, endTime: string) => void;
  /** 既存の内見予約をドラッグ／リサイズで日時変更したとき。false を返すと元に戻す。 */
  onReschedule?: (
    entry: CalendarEntry,
    date: string,
    startTime: string,
    endTime: string
  ) => Promise<boolean>;
}

/** 日時変更（ドラッグ／リサイズ）を許可する予定か。時間指定あり かつ アクティブな予定のみ。 */
function canReschedule(e: CalendarEntry): boolean {
  if (!e.startTime || !e.endTime) return false;
  if (e.kind === '内見予約') return ['未承認', '承認済', '日時変更'].includes(e.status);
  // 社内案内予約はキャンセル以外（確定）を対象とする
  if (e.kind === '社内案内予約') return e.status !== 'キャンセル';
  return false;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function MonthCalendar({
  entries,
  onSelectEntry,
  onSelectDate,
  onSelectRange,
  onReschedule,
}: Props) {
  const ref = useRef<FullCalendar>(null);

  const events: EventInput[] = entries.map((e) => {
    const color = CATEGORY_COLORS[e.category];
    // 開始・終了が未設定の旧データは終日予定として表示する
    const timed = Boolean(e.startTime && e.endTime);
    // 内見予約のアクティブな予定のみドラッグ／リサイズで日時変更可能にする
    const editable = Boolean(onReschedule) && canReschedule(e);
    return {
      id: `${e.kind}-${e.id}`,
      title: e.propertyName,
      start: timed ? `${e.date}T${e.startTime}:00` : e.date,
      end: timed ? `${e.date}T${e.endTime}:00` : undefined,
      allDay: !timed,
      backgroundColor: color.bg,
      borderColor: color.bg,
      textColor: '#ffffff',
      editable,
      extendedProps: { entry: e },
    };
  });

  const handleEventClick = (arg: EventClickArg) => {
    const entry = arg.event.extendedProps.entry as CalendarEntry;
    onSelectEntry(entry);
  };

  // ドラッグ移動／リサイズによる日時変更。編集可否は各イベントの editable(canReschedule) で制御済み。失敗時は元へ戻す。
  const handleEventMutate = async (arg: EventDropArg | EventResizeDoneArg) => {
    const entry = arg.event.extendedProps.entry as CalendarEntry | undefined;
    const start = arg.event.start;
    const end = arg.event.end;
    if (!onReschedule || !entry || !start || !end) {
      arg.revert();
      return;
    }
    const ok = await onReschedule(entry, toDateStr(start), toTimeStr(start), toTimeStr(end));
    if (!ok) arg.revert();
  };

  const handleDateClick = (arg: DateClickArg) => {
    // 月表示で日付をクリックしたらその日の一覧を開く
    if (arg.view.type === 'dayGridMonth') onSelectDate(arg.dateStr);
  };

  const handleSelect = (arg: DateSelectArg) => {
    if (arg.allDay) {
      // 月表示のドラッグは日付のみが決まる
      onSelectRange(toDateStr(arg.start), '', '');
    } else {
      onSelectRange(toDateStr(arg.start), toTimeStr(arg.start), toTimeStr(arg.end));
    }
    ref.current?.getApi().unselect();
  };

  return (
    <div className="fc-wrapper p-3 sm:p-4">
      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={jaLocale}
        timeZone="local"
        height="auto"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        buttonText={{ today: '今日', month: '月', week: '週', day: '日' }}
        events={events}
        // 月表示でも時間指定の予定を「点」ではなく色付きの帯で描画し、区分の色分けを見えるようにする
        eventDisplay="block"
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        // 日時変更（ドラッグ移動・リサイズ）。許可は各イベントの editable で個別制御する。
        editable={Boolean(onReschedule)}
        eventDrop={handleEventMutate}
        eventResize={handleEventMutate}
        eventStartEditable={Boolean(onReschedule)}
        eventDurationEditable={Boolean(onReschedule)}
        selectable
        selectMirror
        // 単なるクリックで選択が走ると dateClick（その日の一覧）と競合するため、
        // 一定距離ドラッグしたときだけ範囲選択とみなす
        selectMinDistance={8}
        select={handleSelect}
        dayMaxEvents={4}
        moreLinkText={(n) => `他${n}件`}
        nowIndicator
        slotMinTime="08:00:00"
        slotMaxTime="21:00:00"
        expandRows
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventContent={(arg) => {
          const entry = arg.event.extendedProps.entry as CalendarEntry;
          const time = entry.startTime && entry.endTime ? `${entry.startTime}〜${entry.endTime}` : '';
          const isMonth = arg.view.type === 'dayGridMonth';
          const cancelled = entry.category === 'キャンセル';
          return (
            <div
              className={`px-1 py-0.5 overflow-hidden leading-tight ${cancelled ? 'line-through opacity-80' : ''}`}
              title={`${time} ${entry.propertyName} / ${entry.companyName} / ${entry.personName}`}
            >
              <div className="text-[11px] font-bold truncate">
                {isMonth && time && <span className="font-mono mr-1">{entry.startTime}</span>}
                {/* アプリ外の手動登録（仲介案内）は「手動」ラベルを付けて区別する */}
                {entry.manual && (
                  <span className="mr-1 px-1 rounded bg-white/30 text-[9px] font-bold align-middle">手動</span>
                )}
                {entry.propertyName}
              </div>
              {!isMonth && (
                <>
                  {time && <div className="text-[10px] font-mono opacity-90">{time}</div>}
                  <div className="text-[10px] truncate opacity-95">{entry.companyName}</div>
                  <div className="text-[10px] truncate opacity-95">{entry.personName}</div>
                </>
              )}
            </div>
          );
        }}
      />

      {/* FullCalendar の既定スタイルを画面のトーンに合わせる */}
      <style jsx global>{`
        .fc-wrapper .fc {
          --fc-border-color: #e2e8f0;
          --fc-today-bg-color: #eef2ff;
          --fc-page-bg-color: #ffffff;
          font-size: 13px;
        }
        .fc-wrapper .fc .fc-toolbar-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
        }
        .fc-wrapper .fc .fc-button {
          background-color: #ffffff;
          border-color: #cbd5e1;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          padding: 5px 11px;
          box-shadow: none;
        }
        .fc-wrapper .fc .fc-button:hover:not(:disabled) {
          background-color: #f1f5f9;
          border-color: #94a3b8;
          color: #0f172a;
        }
        .fc-wrapper .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc-wrapper .fc .fc-button-primary:not(:disabled):active {
          background-color: #4f46e5;
          border-color: #4f46e5;
          color: #ffffff;
        }
        .fc-wrapper .fc .fc-button:focus,
        .fc-wrapper .fc .fc-button:focus-visible {
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.25);
          outline: none;
        }
        .fc-wrapper .fc .fc-button:disabled {
          opacity: 0.45;
        }
        .fc-wrapper .fc .fc-col-header-cell {
          background-color: #f8fafc;
          padding: 7px 0;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
        }
        /* 日曜=赤 / 土曜=青（日本のカレンダー慣習） */
        .fc-wrapper .fc .fc-day-sun .fc-col-header-cell-cushion,
        .fc-wrapper .fc .fc-day-sun .fc-daygrid-day-number {
          color: #dc2626;
        }
        .fc-wrapper .fc .fc-day-sat .fc-col-header-cell-cushion,
        .fc-wrapper .fc .fc-day-sat .fc-daygrid-day-number {
          color: #2563eb;
        }
        .fc-wrapper .fc .fc-daygrid-day-number {
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          padding: 5px 7px;
        }
        .fc-wrapper .fc .fc-day-today .fc-daygrid-day-number {
          background-color: #4f46e5;
          color: #ffffff;
          border-radius: 9999px;
          min-width: 22px;
          text-align: center;
          margin: 3px;
          padding: 3px 6px;
        }
        .fc-wrapper .fc .fc-daygrid-day-frame {
          min-height: 92px;
        }
        .fc-wrapper .fc .fc-event {
          cursor: pointer;
          border-radius: 4px;
          border: none;
        }
        .fc-wrapper .fc .fc-daygrid-day:hover {
          background-color: #f8fafc;
        }
        .fc-wrapper .fc .fc-more-link {
          font-size: 10px;
          font-weight: 700;
          color: #4f46e5;
        }
      `}</style>
    </div>
  );
}
