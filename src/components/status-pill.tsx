import type { AgentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Status color is semantic only: live green, broken red, repairing amber, paused gray, building/testing blue.
const STYLES: Record<AgentStatus, { label: string; dot: string; text: string; pulse?: boolean }> = {
  live: { label: "Live", dot: "bg-emerald-500", text: "text-emerald-800 bg-emerald-50 border-emerald-200" },
  broken: { label: "Broken", dot: "bg-red-500", text: "text-red-800 bg-red-50 border-red-200" },
  repairing: { label: "Repairing", dot: "bg-amber-500", text: "text-amber-900 bg-amber-50 border-amber-200", pulse: true },
  needs_human: { label: "Needs you", dot: "bg-red-600", text: "text-red-900 bg-red-50 border-red-300", pulse: true },
  paused: { label: "Paused", dot: "bg-stone-400", text: "text-stone-600 bg-stone-100 border-stone-200" },
  building: { label: "Building", dot: "bg-sky-500", text: "text-sky-800 bg-sky-50 border-sky-200", pulse: true },
  testing: { label: "Testing", dot: "bg-sky-500", text: "text-sky-800 bg-sky-50 border-sky-200", pulse: true },
  ready: { label: "Ready", dot: "bg-sky-600", text: "text-sky-900 bg-sky-50 border-sky-300" },
};

export function StatusPill({ status, className }: { status: AgentStatus; className?: string }) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide",
        s.text,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot, s.pulse && "animate-pulse")} aria-hidden />
      {s.label}
    </span>
  );
}
