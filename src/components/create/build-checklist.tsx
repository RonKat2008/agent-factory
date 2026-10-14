"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2 } from "lucide-react";
import type { AgentStatus, FeedEvent } from "@/lib/types";
import { Term } from "@/components/explain";
import { DISTANCE, DURATION, EASE, FadeIn, SPRING, STAGGER, TONE, type Tone } from "@/components/motion";
import { cn } from "@/lib/utils";
import { AnimatedCheck, AnimatedCross } from "./animated-check";
import { failLine, fixLine } from "./plain";

type RowState = "pending" | "running" | "done" | "failed" | "fixed";

type Row = { key: string; state: RowState; label: ReactNode; detail?: string };

/** Pairs each failed check with the self-fix that followed it (in order). */
export function pairFixes(events: FeedEvent[]): { failed: FeedEvent; fixed: FeedEvent | null }[] {
  const out: { failed: FeedEvent; fixed: FeedEvent | null }[] = [];
  for (const e of events) {
    if (e.type === "test_failed") out.push({ failed: e, fixed: null });
    else if (e.type === "self_fixed") {
      const i = out.findIndex((p) => p.fixed === null);
      // A fix with no recorded failure still deserves a row: it stands in for both.
      if (i === -1) out.push({ failed: e, fixed: e });
      else out[i] = { ...out[i], fixed: e };
    }
  }
  return out;
}

const step = (done: boolean, started: boolean): RowState => (done ? "done" : started ? "running" : "pending");

function buildRows(status: AgentStatus, events: FeedEvent[], hasPlan: boolean): Row[] {
  const has = (t: FeedEvent["type"]) => events.some((e) => e.type === t);
  const finished = status === "ready" || status === "live";
  const read = hasPlan || events.length > 0 || finished;
  const built = has("built") || has("dry_run") || status === "testing" || finished;
  const tested = has("dry_run") || has("tests_passed") || finished;
  const passed = has("tests_passed") || finished;
  const stuck = status === "needs_human";

  const rows: Row[] = [
    { key: "read", state: step(read, true), label: "Understood what you asked for" },
    { key: "build", state: step(built, read), label: "Built your agent from ready-made parts" },
    {
      key: "test",
      state: step(tested, built),
      label: (
        <>
          <Term id="dry-run">Test run</Term> on real data
        </>
      ),
    },
  ];
  for (const { failed, fixed } of pairFixes(events)) {
    rows.push(
      fixed
        ? { key: failed.id, state: "fixed", label: fixLine(fixed.message) }
        : { key: failed.id, state: "failed", label: "A check failed", detail: failLine(failed.message) },
    );
  }
  rows.push({
    key: "checks",
    state: stuck ? "failed" : step(passed, tested),
    label: stuck ? (
      "Couldn’t pass every check"
    ) : (
      <>
        All <Term id="tests">checks</Term> passed
      </>
    ),
  });
  return rows;
}

function RowIcon({ state }: { state: RowState }) {
  if (state === "running") return <Loader2 className="size-5 shrink-0 animate-spin text-amber-600" aria-label="In progress" />;
  if (state === "done") return <AnimatedCheck tone="emerald" label="Done" />;
  if (state === "fixed") return <AnimatedCheck tone="violet" label="Fixed" />;
  if (state === "failed") return <AnimatedCross />;
  return <span className="block size-5 shrink-0 rounded-full border-2 border-stone-300" aria-label="Not started" role="img" />;
}

const RING: Partial<Record<RowState, Tone>> = { failed: "red", fixed: "violet" };

/** One expanding ring the moment a row turns red (failed) or violet (fixed). Opacity + scale only. */
function Ring({ tone }: { tone: Tone }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[4px]"
      style={{ boxShadow: `0 0 0 2px ${TONE[tone]}` }}
      initial={{ opacity: 0.9, scale: 1 }}
      animate={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: DURATION.slow * 1.5, ease: EASE.out }}
    />
  );
}

function ChecklistRow({ row, delay }: { row: Row; delay: number }) {
  const tinted = row.state === "failed" || row.state === "fixed";
  const ring = RING[row.state];
  return (
    <motion.li
      layout="position"
      className="relative flex items-start gap-3 rounded-[4px] px-3 py-2.5"
      initial={{ opacity: 0, y: DISTANCE.sm }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ ...SPRING.gentle, delay }}
    >
      {/* Tints crossfade (opacity only) so failed → fixed reads as one row changing colour. */}
      <motion.span aria-hidden className="absolute inset-0 rounded-[4px] bg-red-50" initial={false} animate={{ opacity: row.state === "failed" ? 1 : 0 }} transition={{ duration: DURATION.normal }} />
      <motion.span aria-hidden className="absolute inset-0 rounded-[4px] bg-violet-50" initial={false} animate={{ opacity: row.state === "fixed" ? 1 : 0 }} transition={{ duration: DURATION.normal }} />
      {ring && <Ring key={row.state} tone={ring} />}
      <span className="relative mt-px">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={row.state}
            className="block"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: DURATION.instant } }}
            transition={SPRING.snappy}
          >
            <RowIcon state={row.state} />
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="relative min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={tinted ? row.state : "plain"}
            className={cn(
              "block text-[15px] leading-snug",
              row.state === "pending" && "text-stone-400",
              row.state === "running" && "text-stone-900",
              row.state === "done" && "text-stone-800",
              row.state === "failed" && "font-medium text-red-800",
              row.state === "fixed" && "font-medium text-violet-900",
            )}
            initial={{ opacity: 0, y: DISTANCE.xs }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -DISTANCE.xs, transition: { duration: DURATION.fast } }}
            transition={{ duration: DURATION.normal, ease: EASE.out }}
          >
            {row.label}
            {row.detail && <span className="mt-0.5 block font-mono text-[12px] font-normal text-red-700/80">{row.detail}</span>}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.li>
  );
}

type Props = { status: AgentStatus; events: FeedEvent[]; hasPlan: boolean; title: string; reconnecting?: boolean };

/** "Your agent is being built": rows tick in one by one; a failed check morphs into "Fixed: … and re-tested ✓". */
export function BuildChecklist({ status, events, hasPlan, title, reconnecting }: Props) {
  const rows = buildRows(status, events, hasPlan);
  // Rows present on first paint enter as a stagger; rows added later (a failure, a fix) enter on their own.
  const [initialKeys] = useState(() => new Set(rows.map((r) => r.key)));
  const ready = status === "ready" || status === "live";
  const working = !ready && status !== "needs_human";
  return (
    <section data-tour="build-log" aria-labelledby="build-title" className="overflow-hidden rounded-[6px] border border-stone-300 bg-[#FBFAF7] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <h3 id="build-title" className="text-[15px] font-semibold text-stone-900" aria-live="polite">
          {title}
        </h3>
        {working && (
          <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-sky-700">
            <span className="size-1.5 rounded-full bg-sky-500 motion-safe:animate-pulse" aria-hidden />
            {reconnecting ? "Reconnecting…" : "Working"}
          </span>
        )}
      </header>
      <ol className="grid gap-0.5 p-2" aria-label="Build steps">
        <AnimatePresence>
          {rows.map((row, i) => (
            <ChecklistRow key={row.key} row={row} delay={initialKeys.has(row.key) ? i * STAGGER.loose : 0} />
          ))}
        </AnimatePresence>
      </ol>
      <AnimatePresence>
        {ready && (
          <FadeIn y={DISTANCE.sm} className="border-t border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[14px] font-medium text-emerald-800">
            All checks passed — ready to turn on
          </FadeIn>
        )}
      </AnimatePresence>
    </section>
  );
}
