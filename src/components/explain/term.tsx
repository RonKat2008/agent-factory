"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, type GlossaryId } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import { DISTANCE, DURATION, EASE } from "@/components/motion/tokens";
import { useIsHydrating } from "@/components/motion/use-hydrating";
import { useExplainMode } from "./explain-store";

const POPOVER_W = 280;
const GAP = 8;
const EDGE = 12;
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 140;

type Pos = { left: number; top: number; above: boolean };

function place(el: HTMLElement): Pos {
  const r = el.getBoundingClientRect();
  const left = Math.min(Math.max(EDGE, r.left + r.width / 2 - POPOVER_W / 2), window.innerWidth - POPOVER_W - EDGE);
  const above = r.bottom + 170 > window.innerHeight && r.top > 190;
  return { left, top: above ? r.top - GAP : r.bottom + GAP, above };
}

type TermProps = {
  id: GlossaryId;
  /** Visible label; defaults to the glossary term name. */
  children?: ReactNode;
  className?: string;
};

/**
 * Jargon with a built-in explanation. Dotted underline; hover, focus or tap opens a small
 * popover with the plain-English meaning and why it matters. In Explain mode every Term on
 * the page glows violet so newcomers can spot what's explainable.
 */
export function Term({ id, children, className }: TermProps) {
  const entry = GLOSSARY[id];
  const explain = useExplainMode();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const popId = useId();
  const hydrating = useIsHydrating();

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = useCallback((delay: number) => {
    clear();
    timer.current = setTimeout(() => ref.current && setPos(place(ref.current)), delay);
  }, []);
  const hide = useCallback((delay: number) => {
    clear();
    timer.current = setTimeout(() => setPos(null), delay);
  }, []);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  useEffect(() => clear, []);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        role="button"
        aria-describedby={pos ? popId : undefined}
        aria-expanded={pos !== null}
        data-term={id}
        onMouseEnter={() => show(OPEN_DELAY_MS)}
        onMouseLeave={() => hide(CLOSE_DELAY_MS)}
        onFocus={() => show(0)}
        onBlur={() => hide(0)}
        onClick={() => (pos ? setPos(null) : ref.current && setPos(place(ref.current)))}
        className={cn(
          "cursor-help rounded-[2px] underline decoration-dotted decoration-stone-400 underline-offset-[3px] transition-[background-color,box-shadow,text-decoration-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/50",
          explain && "bg-violet-100/70 decoration-violet-500 shadow-[0_0_0_3px_rgb(237_233_254/0.9),0_0_14px_rgb(124_58_237/0.35)]",
          className,
        )}
        style={{ transitionDuration: `${DURATION.normal}s` }}
      >
        {children ?? entry.term}
      </span>
      {!hydrating &&
        createPortal(
          <AnimatePresence>
            {pos && (
              <motion.div
                key="pop"
                id={popId}
                role="tooltip"
                onMouseEnter={clear}
                onMouseLeave={() => hide(CLOSE_DELAY_MS)}
                className="fixed z-[70] rounded-[4px] border border-stone-300 bg-[#FBFAF7] p-3 text-left shadow-[0_10px_30px_-12px_rgba(28,25,23,0.35),0_1px_0_rgba(0,0,0,0.04)]"
                style={{ left: pos.left, top: pos.top, width: POPOVER_W, translateY: pos.above ? "-100%" : 0 }}
                initial={{ opacity: 0, y: pos.above ? DISTANCE.xs : -DISTANCE.xs, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: DURATION.instant } }}
                transition={{ duration: DURATION.fast, ease: EASE.out }}
              >
                <p className="text-[13px] font-semibold text-stone-900">{entry.term}</p>
                <p className="mt-1 text-[13px] leading-snug text-stone-700">{entry.plain}</p>
                <p className="mt-2 border-t border-dashed border-stone-300 pt-2 text-[12px] leading-snug text-violet-800">
                  <span className="font-medium">Why it matters: </span>
                  {entry.why}
                </p>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
