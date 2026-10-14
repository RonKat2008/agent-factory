"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, X } from "lucide-react";
import { DISTANCE, SPRING } from "@/components/motion";
import { FOCUS } from "@/components/ui-tokens";
import { cn } from "@/lib/utils";
import { TOUR_RETURN_KEY } from "./chapters";

const FOCUS_WAIT_MS = 6000;
const FOCUS_POLL_MS = 200;

function readFlag(): boolean {
  try {
    return sessionStorage.getItem(TOUR_RETURN_KEY) === "1";
  } catch {
    return false;
  }
}

/** After the tour sends a judge to another page: a pill back to the tour, and focus on the #steer box if asked. */
export function TourReturnPill() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setShow(pathname !== "/tour" && readFlag()));
  }, [pathname]);

  // Detail pages render after their data loads, so wait for the edit box before scrolling to it.
  useEffect(() => {
    if (window.location.hash !== "#steer") return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const el = document.getElementById("steer");
      if (el) {
        clearInterval(id);
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.querySelector("textarea")?.focus({ preventScroll: true });
      } else if (Date.now() - t0 > FOCUS_WAIT_MS) clearInterval(id);
    }, FOCUS_POLL_MS);
    return () => clearInterval(id);
  }, [pathname]);

  const dismiss = () => {
    try {
      sessionStorage.removeItem(TOUR_RETURN_KEY);
    } catch {
      /* fine */
    }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="tour-return"
          initial={{ opacity: 0, y: DISTANCE.lg }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: DISTANCE.lg }}
          transition={SPRING.gentle}
          className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stone-900 bg-stone-900 p-1 pl-1 text-[13.5px] text-[#F6F4EF] shadow-[0_10px_30px_-10px_rgba(28,25,23,0.6)]"
        >
          <Link href="/tour" className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium hover:bg-white/10", FOCUS)}>
            <ArrowLeft className="size-3.5" aria-hidden /> Back to the tour
          </Link>
          <button type="button" onClick={dismiss} aria-label="Hide" className={cn("grid size-7 place-items-center rounded-full text-stone-400 hover:bg-white/10 hover:text-white", FOCUS)}>
            <X className="size-3.5" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
