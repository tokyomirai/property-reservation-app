'use client';

/** 15分刻みの時刻候補（00:00〜23:45・96件）。 */
export const TIME_OPTIONS: string[] = Array.from({ length: 96 }, (_, i) => {
  const hour = String(Math.floor(i / 4)).padStart(2, '0');
  const minute = String((i % 4) * 15).padStart(2, '0');
  return `${hour}:${minute}`;
});

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
 * 既存データが15分刻みでない場合（過去の予約の日時変更など）は、
 * その値を候補に加えて表示する。黙って空欄に戻して失うことがないようにする。
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
