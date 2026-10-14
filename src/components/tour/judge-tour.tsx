"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, PartyPopper } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from "@/components/ui-tokens";
import { DISTANCE, DURATION, EASE, SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";
import { markOnboarded } from "@/components/onboarding/onboarding-store";
import { CHAPTERS, GITHUB_URL, TOUR_PROGRESS_KEY, TOUR_RETURN_KEY, type ChapterId } from "./chapters";
import { ChapterBuild } from "./ch-build";
import { ChapterRepair } from "./ch-repair";
import { ChapterChain } from "./ch-chain";
import { ChapterGraph } from "./ch-graph";
import { ChapterOps, ChapterSteer } from "./ch-steer-ops";
import { ChapterConnect } from "./ch-connect";
import { ChapterHood } from "./ch-hood";

const VIEWS: Record<ChapterId, ComponentType> = {
  build: ChapterBuild,
  repair: ChapterRepair,
  chain: ChapterChain,
  graph: ChapterGraph,
  steer: ChapterSteer,
  ops: ChapterOps,
  connect: ChapterConnect,
  hood: ChapterHood,
};
const DONE = CHAPTERS.length; // index of the "You've seen it all" panel

type Progress = { current: number; visited: number[] };

function readProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(TOUR_PROGRESS_KEY) ?? "null") as Partial<Progress> | null;
    const current = typeof raw?.current === "number" && raw.current >= 0 && raw.current <= DONE ? raw.current : 0;
    const visited = Array.isArray(raw?.visited) ? raw.visited.filter((n): n is number => typeof n === "number" && n >= 0 && n < DONE) : [];
    return { current, visited };
  } catch {
    return { current: 0, visited: [] };
  }
}

function writeProgress(p: Progress): void {
  try {
    localStorage.setItem(TOUR_PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress just won't persist */
  }
}

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function Rail({ current, visited, go }: { current: number; visited: Set<number>; go: (i: number) => void }) {
  const pct = Math.round((visited.size / DONE) * 100);
  return (
    <nav aria-label="Tour chapters" className="hidden lg:block">
      <div className="sticky top-20 space-y-4">
        <div>
          <p className="text-[13px] font-semibold text-stone-900">The judge tour</p>
          <p className="text-[12.5px] text-stone-500">About 3 minutes. Skip to any chapter.</p>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Tour progress">
            <motion.div className="h-full origin-left bg-violet-600" initial={false} animate={{ scaleX: pct / 100 }} transition={SPRING.gentle} />
          </div>
        </div>
        <ol className="space-y-0.5">
          {CHAPTERS.map((c, i) => {
            const active = i === current;
            const seen = visited.has(i);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "relative flex w-full items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left text-[13.5px] transition-colors",
                    FOCUS,
                    active ? "text-stone-950" : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-900",
                  )}
                >
                  {active && <motion.span layoutId="tour-rail-active" className="absolute inset-0 rounded-[3px] border border-stone-900 bg-white" transition={SPRING.snappy} />}
                  <span
                    className={cn(
                      "relative grid size-5 shrink-0 place-items-center rounded-full font-mono text-[11px] tabular-nums",
                      seen && !active ? "bg-violet-600 text-white" : active ? "bg-stone-900 text-white" : "border border-stone-300 text-stone-500",
                    )}
                  >
                    {seen && !active ? <Check className="size-3" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn("relative", active && "font-semibold")}>{c.short}</span>
                  {seen && <span className="sr-only">(seen)</span>}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="text-[12px] text-stone-500">
          Tip: use <kbd className="rounded-[2px] border border-stone-300 bg-white px-1 font-mono">←</kbd> <kbd className="rounded-[2px] border border-stone-300 bg-white px-1 font-mono">→</kbd> to move between chapters.
        </p>
      </div>
    </nav>
  );
}

function Stepper({ current, visited, go }: { current: number; visited: Set<number>; go: (i: number) => void }) {
  return (
    <nav aria-label="Tour chapters" className="space-y-2 lg:hidden">
      <ol className="flex gap-1" aria-hidden>
        {CHAPTERS.map((c, i) => (
          <li key={c.id} className={cn("h-1.5 flex-1 rounded-full", i === current ? "bg-stone-900" : visited.has(i) ? "bg-violet-500" : "bg-stone-300")} />
        ))}
      </ol>
      <label className="flex items-center gap-2 text-[13px] text-stone-600">
        <span className="shrink-0">Skip to</span>
        <select
          value={current}
          onChange={(e) => go(Number(e.target.value))}
          className={cn("min-w-0 flex-1 rounded-[3px] border border-stone-300 bg-white px-2 py-1.5 text-[14px] text-stone-900", FOCUS)}
        >
          {CHAPTERS.map((c, i) => (
            <option key={c.id} value={i}>{i + 1}. {c.title}{visited.has(i) ? " ✓" : ""}</option>
          ))}
          <option value={DONE}>You&apos;ve seen it all</option>
        </select>
      </label>
    </nav>
  );
}

function Finale({ restart }: { restart: () => void }) {
  return (
    <section aria-labelledby="finale-title" className="space-y-6">
      <motion.div initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={SPRING.bouncy} className="grid size-14 place-items-center rounded-full bg-violet-600 text-white">
        <PartyPopper className="size-7" aria-hidden />
      </motion.div>
      <h2 id="finale-title" className="text-[clamp(30px,4.4vw,48px)] font-semibold leading-[1.04] tracking-[-0.03em] text-stone-900">You&apos;ve seen it all</h2>
      <p className="max-w-[56ch] text-[18px] leading-relaxed text-stone-700">
        Other tools help you build an agent. Pitcrew takes responsibility for keeping it running: tested before it ships, repaired when the world changes, and steerable in plain English.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className={cn(BTN_PRIMARY, "h-11 px-5 text-[15px]")}>Build your own agent</Link>
        <Link href="/fleet" className={cn(BTN_SECONDARY, "h-11 px-4")}>See the live fleet</Link>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={cn(BTN_SECONDARY, "h-11 px-4")}>
          Source on GitHub <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      </div>
      <button type="button" onClick={restart} className="text-[13px] text-stone-500 underline underline-offset-2 hover:text-stone-900">Start the tour over</button>
    </section>
  );
}

export function JudgeTour() {
  const [progress, setProgress] = useState<Progress>({ current: 0, visited: [] });
  const [ready, setReady] = useState(false);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    // The tour is the intro: don't stack the first-visit spotlight on top of it.
    markOnboarded();
    queueMicrotask(() => {
      const p = readProgress();
      setProgress({ current: p.current, visited: Array.from(new Set([...p.visited, ...(p.current < DONE ? [p.current] : [])])) });
      setReady(true);
    });
    try {
      sessionStorage.removeItem(TOUR_RETURN_KEY);
    } catch {
      /* fine */
    }
  }, []);

  const go = (i: number) => {
    const next = Math.max(0, Math.min(DONE, i));
    if (next === progress.current) return;
    const visited = next < DONE && !progress.visited.includes(next) ? [...progress.visited, next] : progress.visited;
    const np = { current: next, visited };
    setDir(next > progress.current ? 1 : -1);
    setProgress(np);
    writeProgress(np);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { current } = progress;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([aria-hidden="true"])')) return;
      if (e.key === "ArrowRight") go(current + 1);
      else if (e.key === "ArrowLeft") go(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const visited = new Set(progress.visited);
  const View = current < DONE ? VIEWS[CHAPTERS[current].id] : null;

  return (
    <div className="mx-auto max-w-[1180px] py-2">
      <header className="mb-6 max-w-[70ch] space-y-2 lg:mb-8">
        <h1 className="t-title text-[clamp(28px,3.2vw,34px)]">Formation lap: see everything Pitcrew does in 3 minutes</h1>
        <p className="text-[15px] leading-relaxed text-stone-600">
          Eight short chapters. Each one explains a feature in plain English, says why it matters, and lets you try it live on this deployment. No sign-up needed.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
        <Rail current={current} visited={visited} go={go} />
        <Stepper current={current} visited={visited} go={go} />
        <div className="min-w-0">
          {ready ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current}
                initial={{ opacity: 0, x: DISTANCE.lg * dir }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -DISTANCE.lg * dir }}
                transition={{ duration: DURATION.fast, ease: EASE.out }}
              >
                {View ? <View /> : <Finale restart={() => go(0)} />}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="h-[480px]" aria-hidden />
          )}
          {current < DONE && (
            <footer className="mt-8 flex items-center justify-between gap-3 border-t border-stone-300 pt-4">
              <button type="button" onClick={() => go(current - 1)} disabled={current === 0} className={cn(BTN_SECONDARY, "h-10 px-4")}>
                <ArrowLeft className="size-4" aria-hidden /> Back
              </button>
              <span className="hidden font-mono text-[12px] tabular-nums text-stone-500 sm:inline">{current + 1} / {DONE}</span>
              <button type="button" onClick={() => go(current + 1)} className={cn(BTN_PRIMARY, "h-10 px-4")}>
                {current === DONE - 1 ? "Finish" : `Next: ${CHAPTERS[current + 1].short}`} <ArrowRight className="size-4" aria-hidden />
              </button>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
