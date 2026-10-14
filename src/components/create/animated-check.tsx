"use client";

import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE, SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";

const TONES = {
  emerald: "bg-emerald-600",
  violet: "bg-violet-600",
  stone: "bg-stone-900",
} as const;

type Props = {
  tone?: keyof typeof TONES;
  /** Seconds before the circle pops and the tick draws. */
  delay?: number;
  className?: string;
  label?: string;
};

/** A filled circle that pops in (0.6 → 1, bouncy) and a tick that draws itself (pathLength 0 → 1). */
export function AnimatedCheck({ tone = "emerald", delay = 0, className, label }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("grid size-5 shrink-0 place-items-center rounded-full text-white", TONES[tone], className)}
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...SPRING.bouncy, delay }}
    >
      <svg viewBox="0 0 16 16" className="size-[62%]" fill="none" aria-hidden>
        <motion.path
          d="M3.5 8.5l3 3 6-7"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: DURATION.normal, ease: EASE.out, delay: delay + DURATION.fast }}
        />
      </svg>
    </motion.span>
  );
}

/** The red "this check failed" mark: a circle with an X drawn in two strokes. */
export function AnimatedCross({ delay = 0, className }: { delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className={cn("grid size-5 shrink-0 place-items-center rounded-full bg-red-600 text-white", className)}
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...SPRING.bouncy, delay }}
    >
      <svg viewBox="0 0 16 16" className="size-[56%]" fill="none" aria-hidden>
        {["M4.5 4.5l7 7", "M11.5 4.5l-7 7"].map((d, i) => (
          <motion.path
            key={d}
            d={d}
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: DURATION.fast, ease: EASE.out, delay: delay + DURATION.fast + i * DURATION.fast }}
          />
        ))}
      </svg>
    </motion.span>
  );
}
