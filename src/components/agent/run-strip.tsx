"use client";
import type { Run } from "@/lib/types";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING } from "@/components/motion";
import { Term } from "@/components/explain";
import { fullTime, relTime } from "./format";

const MAX = 30;

function tone(r: Run): { cls: string; label: string } {
  if (r.kind === "repair_test") return { cls: "bg-violet-500", label: "testing a fix" };
  switch (r.status) {
    case "succeeded":
      return { cls: "bg-emerald-500", label: "ok" };
    case "failed":
      return { cls: "bg-red-500", label: "failed" };
    case "awaiting_approval":
      return { cls: "bg-amber-500", label: "awaiting approval" };
    case "rejected":
      return { cls: "bg-amber-500", label: "held" };
    default:
      return { cls: "bg-stone-400 motion-safe:animate-pulse", label: "running" };
  }
}

const LEGEND = [
  ["bg-emerald-500", "ok"],
  ["bg-red-500", "failed"],
  ["bg-amber-500", "held"],
  ["bg-violet-500", "testing a fix"],
] as const;

/** Last 30 runs, oldest to newest, as clickable status bars. */
export function RunStrip({ runs, onSelect }: { runs: Run[]; onSelect: (id: string) => void }) {
  const shown = runs.slice(0, MAX).reverse();
  if (shown.length === 0) return null;
  return (
    <section aria-label="Recent runs" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium text-stone-700">
          Last {shown.length} <Term id="run">runs</Term>{" "}
          <span className="font-normal text-stone-500">(tap one to see what happened)</span>
        </h2>
        <ul className="flex items-center gap-3 text-[11px] text-stone-500">
          {LEGEND.map(([c, l]) => (
            <li key={l} className="flex items-center gap-1">
              <span className={cn("inline-block h-2.5 w-1 rounded-[1px]", c)} aria-hidden />
              {l}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex h-8 items-end gap-[3px]">
        {shown.map((r) => {
          const t = tone(r);
          const title = `${t.label} · ${r.kind} · v${r.version} · ${relTime(r.startedAt)} (${fullTime(r.startedAt)})`;
          return (
            <motion.button
              key={r.id}
              type="button"
              whileHover={{ y: -2 }}
              transition={SPRING.snappy}
              title={title}
              aria-label={title}
              onClick={() => onSelect(r.id)}
              className="group flex h-full max-w-3 min-w-1 flex-1 items-end rounded-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/60"
            >
              <span
                className={cn(
                  "block h-full w-full origin-bottom rounded-[1px] transition-transform group-hover:scale-y-110",
                  t.cls,
                )}
              />
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
