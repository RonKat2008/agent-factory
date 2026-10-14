"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DURATION, EASE, SPRING } from "@/components/motion";
import { FOCUS } from "@/components/ui-tokens";
import { FactoryFloor } from "./factory-floor";

/** The factory-floor charts, tucked away by default so beginners see less. */
export function FleetAnalytics({ agents, now }: { agents: Agent[]; now: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section aria-label="Fleet analytics" className="border-t border-stone-300 pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex items-center gap-1.5 rounded-[3px] py-1 pr-2 text-[14px] font-medium text-stone-700 hover:text-stone-900", FOCUS)}
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={SPRING.snappy} className="inline-flex">
          <ChevronRight className="size-4" aria-hidden />
        </motion.span>
        Fleet analytics
        <span className="text-[13px] font-normal text-stone-500">{open ? "Hide charts" : "Show charts"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="charts"
            id={id}
            style={{ transformOrigin: "top" }}
            initial={{ opacity: 0, scaleY: 0.92 }}
            animate={{ opacity: 1, scaleY: 1, transition: SPRING.gentle }}
            exit={{ opacity: 0, scaleY: 0.96, transition: { duration: DURATION.fast, ease: EASE.in } }}
          >
            <FactoryFloor agents={agents} now={now} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
