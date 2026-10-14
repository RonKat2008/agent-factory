"use client";

import { cn } from "@/lib/utils";
import { toggleExplainMode, useExplainMode } from "./explain-store";

/**
 * The "?" switch. On: every <Term> on the page glows so newcomers can see what's explainable.
 * Off: Terms still explain themselves on hover/focus. Preference persists (localStorage).
 */
export function ExplainToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const on = useExplainMode();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggleExplainMode}
      title={on ? "Explain mode is on: underlined words explain themselves" : "Turn on Explain mode"}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] border px-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60",
        on
          ? "border-violet-300 bg-violet-50 text-violet-800 shadow-[0_0_12px_rgb(124_58_237/0.25)]"
          : "border-stone-300 bg-[#FBFAF7] text-stone-700 hover:bg-stone-100",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-[18px] place-items-center rounded-full font-mono text-[11px] font-bold",
          on ? "bg-violet-600 text-white" : "bg-stone-200 text-stone-700",
        )}
      >
        ?
      </span>
      {withLabel ? <span>Explain mode</span> : <span className="sr-only">Explain mode</span>}
    </button>
  );
}
