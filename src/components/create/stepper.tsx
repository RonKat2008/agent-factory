"use client";

import { motion, useReducedMotion } from "motion/react";
import { Term } from "@/components/explain";
import { DURATION, EASE, SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";
import { AnimatedCheck } from "./animated-check";

/** 0 Describe · 1 Build · 2 Test run · 3 Turn on · 4 everything done (the agent is on). */
export type StepIndex = 0 | 1 | 2 | 3 | 4;

const STEPS = [
  { key: "describe", label: <>Describe</>, text: "Describe" },
  { key: "build", label: <>Build</>, text: "Build" },
  { key: "test", label: <Term id="dry-run">Test run</Term>, text: "Test run" },
  { key: "on", label: <>Turn on</>, text: "Turn on" },
] as const;

const LAST = STEPS.length - 1;

export function Stepper({ current }: { current: StepIndex }) {
  const reduce = useReducedMotion();
  const progress = Math.min(current, LAST) / LAST;
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="relative grid grid-cols-4">
        {/* Track + animated fill, running between the first and last circle centers. */}
        <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[13px] h-[2px] rounded-full bg-stone-300" />
        <motion.span
          aria-hidden
          className="absolute left-[12.5%] right-[12.5%] top-[13px] h-[2px] origin-left rounded-full bg-violet-600"
          initial={false}
          animate={{ scaleX: progress }}
          transition={SPRING.gentle}
        />
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.key} className="relative flex flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
              <span className="relative grid size-7 place-items-center">
                {active && !reduce && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-violet-500/30"
                    animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
                    transition={{ duration: DURATION.crawl * 1.4, repeat: Infinity, ease: EASE.out }}
                  />
                )}
                {done ? (
                  <AnimatedCheck key="done" tone="stone" className="size-7" label={`${s.text}: done`} />
                ) : (
                  <motion.span
                    layout
                    className={cn(
                      "relative grid size-7 place-items-center rounded-full border-2 bg-[#F6F4EF] font-mono text-[12px] font-semibold tabular-nums transition-colors",
                      active ? "border-violet-700 bg-violet-700 text-white" : "border-stone-300 text-stone-400",
                    )}
                  >
                    {i + 1}
                  </motion.span>
                )}
              </span>
              <span
                className={cn(
                  "text-[13px] sm:text-[14px]",
                  active ? "font-semibold text-stone-900" : done ? "text-stone-700" : "text-stone-400",
                  !active && "max-sm:sr-only",
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
