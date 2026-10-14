"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { AgentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DISTANCE, DURATION, EASE, SPRING, TONE, type Tone } from "./tokens";

// Mirrors <StatusPill> colors (status color is semantic only). Labels are the plain-English set.
const STYLES: Record<AgentStatus, { label: string; dot: string; text: string; tone: Tone; busy?: boolean }> = {
  live: { label: "Live", dot: "bg-emerald-500", text: "text-emerald-800 bg-emerald-50 border-emerald-200", tone: "emerald" },
  broken: { label: "Broken", dot: "bg-red-500", text: "text-red-800 bg-red-50 border-red-200", tone: "red" },
  repairing: { label: "Fixing itself", dot: "bg-amber-500", text: "text-amber-900 bg-amber-50 border-amber-200", tone: "amber", busy: true },
  needs_human: { label: "Needs you", dot: "bg-red-600", text: "text-red-900 bg-red-50 border-red-300", tone: "red", busy: true },
  paused: { label: "Paused", dot: "bg-stone-400", text: "text-stone-600 bg-stone-100 border-stone-200", tone: "stone" },
  building: { label: "Building", dot: "bg-sky-500", text: "text-sky-800 bg-sky-50 border-sky-200", tone: "sky", busy: true },
  testing: { label: "Testing", dot: "bg-sky-500", text: "text-sky-800 bg-sky-50 border-sky-200", tone: "sky", busy: true },
  ready: { label: "Ready to go live", dot: "bg-sky-600", text: "text-sky-900 bg-sky-50 border-sky-300", tone: "sky" },
};

/** How long the recovery check mark stays next to the label. */
const CELEBRATE_MS = 4000;

const TROUBLE = new Set<AgentStatus>(["broken", "repairing", "needs_human"]);

export function statusLabel(status: AgentStatus): string {
  return STYLES[status].label;
}

type Flash = { id: number; tone: Tone; recovered: boolean };

type StatusMorphProps = {
  status: AgentStatus;
  className?: string;
  /** Larger pill for headers. */
  size?: "sm" | "md";
};

/**
 * Status pill that morphs when the status changes: the label crossfades/slides, and a ring
 * pulses in the new status color. Recovering to Live from broken/repairing gets a fuller
 * emerald burst plus a check tick (the "it fixed itself" moment). First render never animates.
 */
export function StatusMorph({ status, className, size = "sm" }: StatusMorphProps) {
  const [prev, setPrev] = useState(status);
  const [flash, setFlash] = useState<Flash | null>(null);
  if (status !== prev) {
    setPrev(status);
    setFlash({ id: (flash?.id ?? 0) + 1, tone: STYLES[status].tone, recovered: status === "live" && TROUBLE.has(prev) });
  }
  useEffect(() => {
    if (!flash?.recovered) return;
    const t = setTimeout(() => setFlash((f) => (f ? { ...f, recovered: false } : f)), CELEBRATE_MS);
    return () => clearTimeout(t);
  }, [flash]);
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "relative inline-flex items-center overflow-visible rounded-sm border font-mono uppercase tracking-wide transition-colors",
        size === "md" ? "h-7 gap-2 px-2.5 text-[12px]" : "h-[22px] gap-1.5 px-1.5 text-[11px]",
        s.text,
        className,
      )}
      style={{ transitionDuration: `${DURATION.normal}s` }}
    >
      <span className={cn("relative size-1.5 shrink-0 rounded-full", s.dot)} aria-hidden>
        {s.busy && <span className={cn("absolute inset-0 rounded-full motion-safe:animate-ping", s.dot)} />}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          className="whitespace-nowrap"
          initial={{ opacity: 0, y: DISTANCE.xs * 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -DISTANCE.xs * 2 }}
          transition={{ duration: DURATION.fast, ease: EASE.out }}
        >
          {s.label}
        </motion.span>
      </AnimatePresence>
      <AnimatePresence>
        {flash && (
          <motion.span
            key={flash.id}
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-sm"
            style={{ boxShadow: `0 0 0 2px ${TONE[flash.tone]}` }}
            initial={{ opacity: 0.85, scale: 1 }}
            animate={{ opacity: 0, scale: flash.recovered ? 1.6 : 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: flash.recovered ? DURATION.crawl : DURATION.slow, ease: EASE.out }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flash?.recovered && status === "live" && (
          <motion.svg
            key={`tick-${flash.id}`}
            viewBox="0 0 12 12"
            aria-hidden
            className="size-3 text-emerald-600"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING.bouncy}
          >
            <motion.path
              d="M2 6.5 4.8 9 10 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: DURATION.normal, ease: EASE.out, delay: DURATION.fast }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </span>
  );
}
