import { cn } from "@/lib/utils";

export type PillState = "connected" | "not_connected" | "ready" | "env";

const PILL: Record<PillState, { label: string; dot: string; text: string }> = {
  connected: { label: "Connected", dot: "bg-emerald-500", text: "text-emerald-800 bg-emerald-50 border-emerald-200" },
  env: { label: "Connected · env", dot: "bg-emerald-500", text: "text-emerald-800 bg-emerald-50 border-emerald-200" },
  not_connected: { label: "Not connected", dot: "bg-stone-400", text: "text-stone-600 bg-stone-100 border-stone-200" },
  ready: { label: "Ready", dot: "bg-sky-600", text: "text-sky-900 bg-sky-50 border-sky-300" },
};

export function ConnPill({ state }: { state: PillState }) {
  const s = PILL[state];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide", s.text)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

export const BTN_BASE =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-[3px] px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40 disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_PRIMARY = cn(BTN_BASE, "bg-stone-900 text-[#F6F4EF] hover:bg-stone-700");
export const BTN_SECONDARY = cn(BTN_BASE, "border border-stone-300 bg-[#FBFAF7] text-stone-800 hover:border-stone-500 hover:bg-white");
export const BTN_DANGER = cn(BTN_BASE, "border border-stone-300 bg-transparent text-red-700 hover:border-red-300 hover:bg-red-50");

export const INPUT =
  "h-8 w-full min-w-0 rounded-[3px] border border-stone-300 bg-white px-2.5 font-mono text-[12.5px] text-stone-900 placeholder:text-stone-400 focus-visible:border-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/20";

export const LABEL = "font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500";

export function relTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s)) return null;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
