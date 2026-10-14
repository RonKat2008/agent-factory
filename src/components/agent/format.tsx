import type { ReactNode } from "react";

export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const s = Math.round(abs / 1000);
  let v: string;
  if (s < 45) v = `${s}s`;
  else if (s < 3600) v = `${Math.round(s / 60)}m`;
  else if (s < 86400) v = `${Math.round(s / 3600)}h`;
  else v = `${Math.round(s / 86400)}d`;
  if (s < 5) return "just now";
  return diff < 0 ? `${v} ago` : `in ${v}`;
}

export const fullTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "");

export function durationMs(start: string, end: string | null): string {
  if (!end) return "…";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export const usd = (n: number) => `$${n < 0.1 ? n.toFixed(4) : n.toFixed(2)}`;

export const LABEL = "font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500";
export const PANEL = "bg-[#FBFAF7] border border-stone-300 rounded-[3px] shadow-[0_1px_0_rgba(0,0,0,0.04)]";
export const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-[3px] px-3 h-8 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40 disabled:opacity-50 disabled:pointer-events-none";
export const BTN_PRIMARY = `${BTN} bg-stone-900 text-[#F6F4EF] hover:bg-stone-700`;
export const BTN_SECONDARY = `${BTN} border border-stone-300 bg-[#FBFAF7] text-stone-900 hover:bg-stone-100`;

const LINK_RE = /<(https?:\/\/[^|>\s]+)\|([^>]+)>|(https?:\/\/[^\s<>)\]]+)/g;
const linkCls = "text-sky-700 underline underline-offset-2 hover:text-sky-900 break-all";

/** Renders Slack `<url|label>` links and bare URLs as safe anchors. */
export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const href = m[1] ?? m[3];
    const label = m[2] ?? m[3];
    out.push(
      <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={linkCls}>
        {label}
      </a>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
