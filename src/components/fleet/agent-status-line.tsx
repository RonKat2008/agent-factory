"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Agent } from "@/lib/types";
import { relTime } from "@/components/time";
import { DURATION, EASE } from "@/components/motion";

type Line = { text: string; tone: string; shimmer?: boolean };

function describe(a: Agent, now: number): Line {
  switch (a.status) {
    case "live":
      if (a.lastOutput) return { text: `sent ${relTime(a.lastOutput.at, now)}`, tone: "text-stone-600" };
      if (a.lastRunAt) return { text: `checked ${relTime(a.lastRunAt, now)}, nothing new`, tone: "text-stone-600" };
      return { text: "waiting for its first run", tone: "text-stone-600" };
    case "repairing":
      return { text: "Rewriting the broken step and re-testing…", tone: "text-amber-800", shimmer: true };
    case "broken":
      return { text: "Something broke. It will try to fix itself.", tone: "text-red-700" };
    case "needs_human":
      return { text: "It couldn't fix this alone. Open it to help.", tone: "text-red-700 font-medium" };
    case "paused":
      return { text: "Not running until you resume it", tone: "text-stone-500" };
    case "ready":
      return { text: "Tested and ready to turn on", tone: "text-sky-800" };
    default:
      return { text: "Getting ready…", tone: "text-sky-800", shimmer: true };
  }
}

/** The plain sentence next to the status pill. Crossfades when the status changes. */
export function AgentStatusLine({ agent, now }: { agent: Agent; now: number }) {
  const reduce = useReducedMotion();
  const line = describe(agent, now);
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={agent.status}
        className={`text-[13px] ${line.tone}`}
        initial={{ opacity: 0 }}
        animate={line.shimmer && !reduce ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: DURATION.fast, ease: EASE.in } }}
        transition={
          line.shimmer && !reduce
            ? { duration: DURATION.crawl * 1.6, ease: EASE.inOut, repeat: Infinity }
            : { duration: DURATION.normal, ease: EASE.out }
        }
      >
        {line.text}
      </motion.span>
    </AnimatePresence>
  );
}
