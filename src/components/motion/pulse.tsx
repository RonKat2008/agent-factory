"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DURATION, EASE, TONE, type Tone } from "./tokens";

type PulseProps = {
  children: ReactNode;
  /** Change this value (e.g. an event id or counter) to fire one ring. The initial value never fires. */
  trigger: string | number | null | undefined;
  tone?: Tone;
  /** Corner radius of the ring, match the wrapped element. */
  radius?: number | string;
  className?: string;
};

/**
 * Attention ring for "something just happened": a single outline expands and fades
 * around the wrapped element. Transform + opacity only.
 */
export function Pulse({ children, trigger, tone = "violet", radius = 3, className }: PulseProps) {
  const [seen, setSeen] = useState(trigger);
  const [fired, setFired] = useState(0);
  if (trigger !== seen) {
    setSeen(trigger);
    setFired((n) => n + 1);
  }
  return (
    <span className={cn("relative inline-flex", className)}>
      {children}
      <AnimatePresence>
        {fired > 0 && (
          <motion.span
            key={fired}
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ borderRadius: radius, boxShadow: `0 0 0 2px ${TONE[tone]}` }}
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: 0, scale: 1.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.slow * 1.5, ease: EASE.out }}
          />
        )}
      </AnimatePresence>
    </span>
  );
}
