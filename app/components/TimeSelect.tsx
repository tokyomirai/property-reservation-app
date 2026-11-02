'use client';

/** 内見を受け付ける時間帯（9:30〜19:30）と刻み幅。深夜まで並べると選びにくいため絞る。 */
const START_MINUTES = 9 * 60 + 30;
const END_MINUTES = 19 * 60 + 30;
const STEP_MINUTES = 15;

/** 15分刻みの時刻候補（09:30〜19:30・41件）。 */
export const TIME_OPTIONS: string[] = Array.from(
  { length: (END_MINUTES - START_MINUTES) / STEP_MINUTES + 1 },
  (_, i) => {
    const minutesFromMidnight = START_MINUTES + i * STEP_MINUTES;
    const hour = String(Math.floor(minutesFromMidnight / 60)).padStart(2, '0');
    const minute = String(minutesFromMidnight % 60).padStart(2, '0');
    return `${hour}:${minute}`;
  }
);

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

/**
 * 内見の開始・終了時間を選ぶ欄。
 *
 * ブラウザ標準の <input type="time"> は候補の見た目も並べ方もブラウザ任せで、
 * step で15分刻みを指定しても、未入力時に現在時刻（例: 16:33）が候補に現れるなど
 * 刻みに沿わない値が見えてしまう。選べてしまうと送信時に弾かれ、
 * 申込者には理由が分からない。候補を自前の <select> に固定してこれを防ぐ。
 *
 * 既存データが候補に無い場合（15分刻みでない時刻、受付時間帯の範囲外の
 * 過去の予約など）は、その値を候補に加えて表示する。日時変更の画面を開いただけで
 * 黙って空欄に戻り、元の時刻を失うことがないようにする。
 */
export default function TimeSelect({ value, onChange, required, className }: TimeSelectProps) {
  const options =
    value && !TIME_OPTIONS.includes(value)
      ? [...TIME_OPTIONS, value].sort()
      : TIME_OPTIONS;

  return (
    <select
      required={required}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">--:--</option>
      {options.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}
