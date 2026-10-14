// Tiny relative-time helpers shared by fleet + feed.
export function relTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "never";
  const diff = now - new Date(iso).getTime();
  const future = diff < 0;
  const s = Math.round(Math.abs(diff) / 1000);
  let v: string;
  if (s < 45) v = `${s}s`;
  else if (s < 3600) v = `${Math.round(s / 60)}m`;
  else if (s < 86400) v = `${Math.round(s / 3600)}h`;
  else v = `${Math.round(s / 86400)}d`;
  if (s < 5) return "just now";
  return future ? `in ${v}` : `${v} ago`;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
