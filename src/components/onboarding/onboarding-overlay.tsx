"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { DURATION, EASE, SPRING } from "@/components/motion/tokens";
import { useIsHydrating } from "@/components/motion/use-hydrating";
import { hasOnboarded, markOnboarded, useReplayRequests } from "./onboarding-store";
import { TOUR_STEPS, type TourStep } from "./steps";

const PAD = 8; // spotlight padding around the target
const CARD_W = 340;
const EDGE = 12;
const CARD_GAP = 14;
const CARD_EST_H = 210;
const FIRST_VISIT_DELAY_MS = 900;
const REPLAY_WAIT_MS = 3000;
const POLL_MS = 150;

type Rect = { x: number; y: number; w: number; h: number };
type Resolved = { step: TourStep; target: string };

function findTarget(id: string): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** Steps whose target is on the current page, in order. */
function resolveSteps(): Resolved[] {
  return TOUR_STEPS.flatMap((step) => {
    const target = step.targets.find((t) => findTarget(t));
    return target ? [{ step, target }] : [];
  });
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

function sameRect(a: Rect | null, b: Rect): boolean {
  return !!a && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
}

function cardPosition(rect: Rect): { x: number; y: number; width: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - EDGE * 2);
  const x = Math.min(Math.max(EDGE, rect.x + rect.w / 2 - width / 2), vw - width - EDGE);
  const below = rect.y + rect.h + CARD_GAP;
  const above = rect.y - CARD_GAP - CARD_EST_H;
  let y = below + CARD_EST_H <= vh - EDGE ? below : above >= EDGE ? above : vh - CARD_EST_H - EDGE;
  y = Math.max(EDGE, y);
  return { x, y, width };
}

/**
 * First-visit guided intro. Dims the page, cuts an animated spotlight around each
 * `data-tour` target and shows a caption card. Auto-starts once per browser
 * (localStorage `af_onboarded`), and again whenever `replayIntro()` is called.
 */
export function OnboardingOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const hydrating = useIsHydrating();
  const replay = useReplayRequests();
  const [steps, setSteps] = useState<Resolved[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const active = steps !== null && steps.length > 0;
  const current = active ? steps[Math.min(index, steps.length - 1)] : null;

  const start = useCallback((found: Resolved[]) => {
    setIndex(0);
    setRect(null);
    setSteps(found);
  }, []);

  const finish = useCallback(() => {
    markOnboarded();
    setSteps(null);
    setRect(null);
  }, []);

  // First visit: wait for the page to settle, then start if any target exists here.
  useEffect(() => {
    if (active || hasOnboarded()) return;
    const t = setTimeout(() => {
      const found = resolveSteps();
      if (found.length) start(found);
    }, FIRST_VISIT_DELAY_MS);
    return () => clearTimeout(t);
  }, [pathname, active, start]);

  // Replay requested: use this page's targets, or go home and wait for them.
  useEffect(() => {
    if (replay === 0) return;
    const found = resolveSteps();
    if (found.length) {
      const t = setTimeout(() => start(found), 0);
      return () => clearTimeout(t);
    }
    router.push("/");
    const t0 = Date.now();
    const id = setInterval(() => {
      const later = resolveSteps();
      if (later.length || Date.now() - t0 > REPLAY_WAIT_MS) {
        clearInterval(id);
        if (later.length) start(later);
      }
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per request only
  }, [replay]);

  // Track the current target: scroll it into view, then follow it every frame.
  useEffect(() => {
    if (!current) return;
    let el = findTarget(current.target);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    let raf = 0;
    let last: Rect | null = null;
    const loop = () => {
      if (!el || !el.isConnected) el = findTarget(current.target);
      if (el) {
        const r = measure(el);
        if (!sameRect(last, r)) {
          last = r;
          setRect(r);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [current]);

  // Close on navigation away (targets would be gone).
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      if (current && !findTarget(current.target)) finish();
    }, FIRST_VISIT_DELAY_MS);
    return () => clearTimeout(t);
  }, [pathname, active, current, finish]);

  const isLast = active && index >= steps.length - 1;
  const next = useCallback(() => (isLast ? finish() : setIndex((i) => i + 1)), [isLast, finish]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish, next, back]);

  useEffect(() => {
    if (active) nextRef.current?.focus({ preventScroll: true });
  }, [active, index]);

  if (hydrating) return null;

  const card = rect ? cardPosition(rect) : null;
  const showTourCta = current?.step.key === "repair" && pathname !== "/tour";

  return createPortal(
    <AnimatePresence>
      {active && current && (
        <motion.div
          key="onboarding"
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.normal, ease: EASE.out }}
        >
          {/* Click shield: the page underneath is inert while the intro is open. */}
          <div className="absolute inset-0" aria-hidden />
          {rect && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 rounded-[6px] ring-2 ring-violet-500/90"
              style={{ boxShadow: "0 0 0 9999px rgb(28 25 23 / 0.6), 0 0 28px 4px rgb(124 58 237 / 0.35)" }}
              initial={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }}
              animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }}
              transition={SPRING.glide}
            />
          )}
          {card && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="af-intro-title"
              aria-describedby="af-intro-body"
              className="absolute left-0 top-0 rounded-[4px] border border-stone-300 bg-[#FBFAF7] p-4 shadow-[0_24px_60px_-20px_rgba(28,25,23,0.55)]"
              style={{ width: card.width }}
              initial={{ x: card.x, y: card.y + 8, opacity: 0 }}
              animate={{ x: card.x, y: card.y, opacity: 1 }}
              transition={SPRING.glide}
            >
              <div className="flex items-center justify-between gap-3">
                <ol className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of ${steps.length}`}>
                  {steps.map((s, i) => (
                    <li
                      key={s.step.key}
                      className={cn(
                        "h-1.5 rounded-full transition-[width,background-color] duration-300",
                        i === index ? "w-5 bg-violet-600" : i < index ? "w-1.5 bg-violet-300" : "w-1.5 bg-stone-300",
                      )}
                    />
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={finish}
                  className="rounded-[3px] px-1.5 py-0.5 text-[12px] text-stone-500 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60"
                >
                  Skip intro
                </button>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.step.key}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: DURATION.fast, ease: EASE.out }}
                >
                  <h2 id="af-intro-title" className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-stone-900">
                    {current.step.title}
                  </h2>
                  <p id="af-intro-body" className="mt-1.5 text-[14px] leading-relaxed text-stone-700">
                    {current.step.body}
                  </p>
                </motion.div>
              </AnimatePresence>
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={back}
                  disabled={index === 0}
                  className="inline-flex h-8 items-center rounded-[3px] px-2.5 text-[13px] font-medium text-stone-700 hover:bg-stone-200/70 disabled:invisible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60"
                >
                  Back
                </button>
                <div className="flex items-center gap-2">
                  {isLast && showTourCta && (
                    <button
                      type="button"
                      onClick={() => {
                        finish();
                        router.push("/tour");
                      }}
                      className="inline-flex h-8 items-center rounded-[3px] bg-violet-600 px-3 text-[13px] font-medium text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 focus-visible:ring-offset-2"
                    >
                      Open the Tour
                    </button>
                  )}
                  <button
                    ref={nextRef}
                    type="button"
                    onClick={next}
                    className="inline-flex h-8 items-center rounded-[3px] bg-stone-900 px-3 text-[13px] font-medium text-[#F6F4EF] hover:bg-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 focus-visible:ring-offset-2"
                  >
                    {isLast ? "Got it" : "Next"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
