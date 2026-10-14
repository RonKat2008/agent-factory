"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Hammer, Loader2, RotateCcw } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/ui-tokens";
import { eventStyle } from "@/components/event-style";
import { DISTANCE, SPRING } from "@/components/motion";
import type { EventType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChapterShell } from "./chapter-shell";
import { markLeavingTour } from "./chapters";

const EXAMPLE = "Every morning at 9, send me the top 3 AI news stories in Slack";
const MIN_CHARS = 8;
const STEP_MS = 1100;

const BUILD_STEPS: { type: EventType; at: string; text: string }[] = [
  { type: "built", at: "+04s", text: "Built a 4-step plan: read AI news feeds, rank them, summarize the top 3, post to Slack" },
  { type: "test_failed", at: "+11s", text: "Test run on real data: 3 of 4 checks passed (summary too long for Slack)" },
  { type: "self_fixed", at: "+15s", text: "Fixed it on its own: tightened the summary step" },
  { type: "tests_passed", at: "+22s", text: "Re-tested: 4 of 4 checks passed" },
  { type: "went_live", at: "+23s", text: "Ready: shows you the exact Slack message before it ever runs" },
];

function BuildReplay() {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? BUILD_STEPS.length : 0);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= BUILD_STEPS.length) clearInterval(t);
    }, STEP_MS);
    return () => clearInterval(t);
  }, [round, reduced]);

  const visible = reduced ? BUILD_STEPS.length : shown;
  const done = visible >= BUILD_STEPS.length;

  return (
    <figure className="rounded-[3px] border border-stone-300 bg-white p-4">
      <figcaption className="mb-3 flex items-center justify-between gap-3 text-[13px] text-stone-600">
        <span>A real build, replayed</span>
        <button
          type="button"
          disabled={!done || Boolean(reduced)}
          onClick={() => {
            setShown(0);
            setRound((r) => r + 1);
          }}
          className={cn(BTN_SECONDARY, "h-7 px-2 text-[12px]", reduced && "hidden")}
        >
          <RotateCcw className="size-3" aria-hidden /> Replay
        </button>
      </figcaption>
      <ol className="space-y-2.5" aria-live="polite">
        <AnimatePresence initial={false}>
          {BUILD_STEPS.slice(0, visible).map((s) => {
            const st = eventStyle(s.type);
            const Icon = st.icon;
            return (
              <motion.li
                key={`${round}-${s.type}`}
                initial={{ opacity: 0, y: DISTANCE.sm }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={SPRING.gentle}
                className="flex gap-3"
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", st.color)} aria-hidden />
                <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-stone-800">{s.text}</p>
                <span className="font-mono text-[11px] tabular-nums text-stone-400">{s.at}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {!done && (
          <li className="flex items-center gap-3 text-[12.5px] text-stone-500">
            <Loader2 className="size-4 animate-spin text-stone-400" aria-hidden /> Working…
          </li>
        )}
      </ol>
    </figure>
  );
}

export function ChapterBuild() {
  const router = useRouter();
  const [text, setText] = useState(EXAMPLE);
  const [going, setGoing] = useState(false);
  const canBuild = text.trim().length >= MIN_CHARS && !going;

  const build = () => {
    if (!canBuild) return;
    setGoing(true);
    markLeavingTour();
    router.push(`/new?request=${encodeURIComponent(text.trim())}`);
  };

  return (
    <ChapterShell
      n={1}
      title="Build an agent from one sentence"
      lede={
        <p>
          Describe a recurring job the way you would to a coworker. Pitcrew turns it into a working agent, runs it on real data, checks the result, and shows you the exact Slack message you will get. Nothing goes live until its tests pass.
        </p>
      }
      different={
        <p>
          Most agent builders hand you a first draft and walk away. Here every agent ships with its own tests, and a failed test gets fixed automatically before you ever see it, like the replay below.
        </p>
      }
      tryIt={
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              build();
            }}
          >
            <label htmlFor="tour-build-input" className="block text-[13.5px] text-stone-700">
              Your sentence (edit it if you like)
            </label>
            <textarea
              id="tour-build-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-[4px] border-2 border-stone-900 bg-white p-3 text-[15px] text-stone-900 shadow-[4px_4px_0_0_#1c1917] focus-visible:border-violet-700 focus-visible:shadow-[4px_4px_0_0_#6d28d9] focus-visible:outline-none"
            />
            <button type="submit" disabled={!canBuild} className={cn(BTN_PRIMARY, "h-11 px-5 text-[15px]")}>
              {going ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Hammer className="size-4" aria-hidden />}
              {going ? "Warming up the garage…" : "Build it"}
            </button>
            <p className="text-[12.5px] text-stone-500">
              Opens the live build in about 30 seconds of work. A pill at the bottom brings you back to this chapter.
            </p>
          </form>
          <BuildReplay />
        </div>
      }
      products={["AI Gateway", "Workflow DevKit", "Sandbox", "Neon"]}
      hood={
        <>
          <p>Claude Sonnet (through Vercel AI Gateway) writes a plan out of ready-made blocks: fetch a page, read a feed, summarize, run code, post to Slack. It also writes the checks the output must pass.</p>
          <p>The build runs as a durable Vercel Workflow, so it survives restarts. Code steps run in an isolated Vercel Sandbox. If a check fails, Sonnet patches the plan and the workflow re-tests it. Every version is stored in Neon Postgres.</p>
        </>
      }
    />
  );
}
