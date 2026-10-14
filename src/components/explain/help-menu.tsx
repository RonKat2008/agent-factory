"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DISTANCE, DURATION, EASE, SPRING } from "@/components/motion/tokens";
import { replayIntro } from "@/components/onboarding/onboarding-store";
import { toggleExplainMode, useExplainMode } from "./explain-store";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["?"], label: "Explain mode on / off" },
  { keys: ["g", "h"], label: "Go home (build an agent)" },
  { keys: ["g", "a"], label: "Go to My agents" },
  { keys: ["g", "t"], label: "Open the Tour" },
  { keys: ["Esc"], label: "Close menus and popovers" },
];

const GO: Record<string, string> = { h: "/", a: "/fleet", t: "/tour" };
const CHORD_MS = 900;

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** Global shortcuts listed in the menu: "?" toggles Explain mode, "g h/a/t" navigates. */
function useShortcuts() {
  const router = useRouter();
  useEffect(() => {
    let gAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        toggleExplainMode();
        return;
      }
      if (e.key === "g") {
        gAt = Date.now();
        return;
      }
      if (Date.now() - gAt < CHORD_MS && GO[e.key]) {
        gAt = 0;
        router.push(GO[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}

const ITEM =
  "flex w-full items-center justify-between gap-3 rounded-[3px] px-2.5 py-2 text-left text-[13px] text-stone-800 hover:bg-stone-200/60 focus-visible:bg-stone-200/60 focus-visible:outline-none";

/**
 * Help menu for the top bar: Replay intro, Explain mode switch, Take the tour, Keyboard
 * shortcuts. Also installs the global keyboard shortcuts it lists.
 */
export function HelpMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const explain = useExplainMode();
  const rootRef = useRef<HTMLDivElement>(null);
  useShortcuts();

  useEffect(() => {
    if (!open && !showKeys) return;
    const onDown = (e: MouseEvent) => {
      if (open && rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setShowKeys(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, showKeys]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-[3px] border px-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60",
          explain ? "border-violet-300 bg-violet-50 text-violet-800" : "border-stone-300 bg-[#FBFAF7] text-stone-700 hover:bg-stone-100",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-[18px] place-items-center rounded-full font-mono text-[11px] font-bold",
            explain ? "bg-violet-600 text-white" : "bg-stone-200 text-stone-700",
          )}
        >
          ?
        </span>
        <span>Help</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            role="menu"
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 origin-top-right rounded-[4px] border border-stone-300 bg-[#FBFAF7] p-1 shadow-[0_16px_40px_-16px_rgba(28,25,23,0.45)]"
            initial={{ opacity: 0, y: -DISTANCE.xs, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: DURATION.instant } }}
            transition={SPRING.snappy}
          >
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={() => {
                setOpen(false);
                replayIntro();
              }}
            >
              Replay intro
              <span className="text-[11px] text-stone-500">4 steps</span>
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={explain}
              className={ITEM}
              onClick={toggleExplainMode}
            >
              <span>
                Explain mode
                <span className="block text-[11px] leading-tight text-stone-500">Highlight words that have explanations</span>
              </span>
              <span
                aria-hidden
                className={cn("relative h-4 w-7 shrink-0 rounded-full transition-colors", explain ? "bg-violet-600" : "bg-stone-300")}
              >
                <motion.span
                  className="absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow"
                  animate={{ x: explain ? 12 : 0 }}
                  transition={SPRING.snappy}
                />
              </span>
            </button>
            <Link href="/tour" role="menuitem" className={ITEM} onClick={() => setOpen(false)}>
              Take the 60-second tour
              <span className="text-[11px] text-violet-700">watch a repair</span>
            </Link>
            <div className="my-1 h-px bg-stone-200" />
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={() => {
                setOpen(false);
                setShowKeys(true);
              }}
            >
              Keyboard shortcuts
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showKeys && (
          <motion.div
            key="keys"
            className="fixed inset-0 z-[65] grid place-items-center bg-stone-900/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast, ease: EASE.out }}
            onMouseDown={(e) => e.target === e.currentTarget && setShowKeys(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="af-keys-title"
              className="w-full max-w-sm rounded-[4px] border border-stone-300 bg-[#FBFAF7] p-4 shadow-[0_24px_60px_-20px_rgba(28,25,23,0.55)]"
              initial={{ opacity: 0, y: DISTANCE.sm, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: DISTANCE.sm }}
              transition={SPRING.gentle}
            >
              <div className="flex items-center justify-between">
                <h2 id="af-keys-title" className="text-[15px] font-semibold text-stone-900">
                  Keyboard shortcuts
                </h2>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setShowKeys(false)}
                  className="rounded-[3px] px-2 py-1 text-[12px] text-stone-600 hover:bg-stone-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60"
                >
                  Close
                </button>
              </div>
              <ul className="mt-3 divide-y divide-stone-200">
                {SHORTCUTS.map((s) => (
                  <li key={s.label} className="flex items-center justify-between py-2 text-[13px] text-stone-700">
                    {s.label}
                    <span className="flex gap-1">
                      {s.keys.map((k) => (
                        <kbd key={k} className="min-w-6 rounded-[3px] border border-stone-300 bg-white px-1.5 py-0.5 text-center font-mono text-[11px] text-stone-800 shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
