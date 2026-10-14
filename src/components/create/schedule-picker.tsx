"use client";

import { DAYS, type Freq, type SchedulePick, cronstrueLocal, timezoneName } from "./schedule";
import { cn } from "@/lib/utils";

const FREQS: { value: Freq; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Once a week" },
];

const FIELD =
  "h-10 rounded-[4px] border border-stone-300 bg-white px-2.5 text-[15px] text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/50 disabled:opacity-60";

type Props = { value: SchedulePick; onChange: (p: SchedulePick) => void; disabled?: boolean };

export function SchedulePicker({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="How often" className="flex flex-wrap gap-1.5">
        {FREQS.map((f) => {
          const on = value.freq === f.value;
          return (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange({ ...value, freq: f.value })}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/50 disabled:opacity-60",
                on ? "border-stone-900 bg-stone-900 text-[#F6F4EF]" : "border-stone-300 bg-white text-stone-700 hover:border-stone-900",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[15px] text-stone-700">
        {value.freq === "weekly" && (
          <>
            <label htmlFor="sched-day" className="sr-only">
              Day
            </label>
            <span aria-hidden>on</span>
            <select
              id="sched-day"
              value={value.day}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, day: Number(e.target.value) })}
              className={FIELD}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor="sched-time">at</label>
        <input
          id="sched-time"
          type="time"
          step={600}
          value={value.time}
          disabled={disabled}
          onChange={(e) => e.target.value && onChange({ ...value, time: e.target.value })}
          className={cn(FIELD, "tabular-nums")}
        />
        <span className="text-[13px] text-stone-500">your time ({timezoneName()})</span>
      </div>
      <p className="text-[13px] text-stone-500">{cronstrueLocal(value)}</p>
    </div>
  );
}
