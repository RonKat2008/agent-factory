// Friendly schedule picker <-> UTC cron. Agents run on 5-field UTC crons; people think in their own timezone.
import cronstrue from "cronstrue";

export type Freq = "daily" | "weekdays" | "weekly";
export type SchedulePick = { freq: Freq; day: number; time: string }; // day 0=Sun..6=Sat, time "HH:MM" local

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const WEEKDAY_RANGES: Record<number, string> = { [-1]: "0-4", 0: "1-5", 1: "2-6" };
const SIMPLE_CRON = /^(\d{1,2}) (\d{1,2}) \* \* (\*|\d|[0-6]-[0-6]|1,2,3,4,5)$/;

/** -1, 0 or +1: how the UTC weekday differs from the local weekday at this instant. */
function dayShift(d: Date, fromLocal: boolean): number {
  const raw = fromLocal ? d.getUTCDay() - d.getDay() : d.getDay() - d.getUTCDay();
  if (raw === 6) return -1;
  if (raw === -6) return 1;
  return raw;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function pickToUtcCron(p: SchedulePick): string {
  const [h, m] = p.time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  const shift = dayShift(d, true);
  const dow =
    p.freq === "daily" ? "*" : p.freq === "weekdays" ? WEEKDAY_RANGES[shift] : String((p.day + shift + 7) % 7);
  return `${d.getUTCMinutes()} ${d.getUTCHours()} * * ${dow}`;
}

/** The picker state for a UTC cron, or null when the cron is something the picker can't express (e.g. hourly). */
export function utcCronToPick(cron: string): SchedulePick | null {
  const m = SIMPLE_CRON.exec(cron.trim());
  if (!m) return null;
  const [, min, hour, dowRaw] = m;
  const d = new Date();
  d.setUTCHours(Number(hour), Number(min), 0, 0);
  const shift = dayShift(d, false);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (dowRaw === "*") return { freq: "daily", day: 1, time };
  const dow = dowRaw === "1,2,3,4,5" ? "1-5" : dowRaw;
  if (dow.includes("-")) {
    const start = (Number(dow[0]) + shift + 7) % 7;
    const end = (Number(dow[2]) + shift + 7) % 7;
    return start === 1 && end === 5 ? { freq: "weekdays", day: 1, time } : null;
  }
  return { freq: "weekly", day: (Number(dow) + shift + 7) % 7, time };
}

function clock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function timezoneName(): string {
  try {
    const part = new Intl.DateTimeFormat([], { timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "local time";
  } catch {
    return "local time";
  }
}

export function describePick(p: SchedulePick): string {
  const at = clock(p.time);
  if (p.freq === "daily") return `Every day at ${at}`;
  if (p.freq === "weekdays") return `Every weekday at ${at}`;
  return `Every ${DAYS[p.day]} at ${at}`;
}

/** Plain-English schedule in the viewer's timezone. Falls back to cronstrue (UTC) for unusual crons. */
export function humanSchedule(cron: string): string {
  const pick = utcCronToPick(cron);
  if (pick) return describePick(pick);
  try {
    const text = cronstrue.toString(cron, { verbose: false });
    return /\d:\d\d/.test(text) ? `${text} (UTC)` : text;
  } catch {
    return "On a custom schedule";
  }
}

/** cronstrue reading of the local-time equivalent, e.g. "At 08:00 AM, Monday through Friday". */
export function cronstrueLocal(p: SchedulePick): string {
  const [h, m] = p.time.split(":").map(Number);
  const dow = p.freq === "daily" ? "*" : p.freq === "weekdays" ? "1-5" : String(p.day);
  try {
    return cronstrue.toString(`${m} ${h} * * ${dow}`);
  } catch {
    return describePick(p);
  }
}
