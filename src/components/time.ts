// Shared time helpers (fleet, feed, agent detail, outbox).
export function relTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "never";
  const diff = new Date(iso).getTime() - now;
  const s = Math.round(Math.abs(diff) / 1000);
  if (s < 5) return "just now";
  let v: string;
  if (s < 45) v = `${s}s`;
  else if (s < 3600) v = `${Math.round(s / 60)}m`;
  else if (s < 86400) v = `${Math.round(s / 3600)}h`;
  else v = `${Math.round(s / 86400)}d`;
  return diff < 0 ? `${v} ago` : `in ${v}`;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export const fullTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "");

export function durationMs(start: string, end: string | null): string {
  if (!end) return "…";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
