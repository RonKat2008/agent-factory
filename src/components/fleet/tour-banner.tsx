"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

const KEY = "af-tour-banner-dismissed";

export function TourBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {
      /* storage unavailable: show banner */
    }
    queueMicrotask(() => setShow(!dismissed));
  }, []);
  if (!show) return null;
  return (
    <aside
      aria-label="Tour"
      className="mb-6 flex items-center gap-3 rounded-[4px] border border-violet-200 bg-violet-50/70 px-3.5 py-2.5 text-[14px] text-violet-950"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-600 text-white" aria-hidden>
        <Sparkles className="size-3.5" />
      </span>
      <p className="min-w-0">
        New here? Watch an agent break and fix itself in 60 seconds.{" "}
        <Link
          href="/tour"
          className="whitespace-nowrap font-semibold text-violet-800 underline underline-offset-2 hover:text-violet-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60"
        >
          Take the tour
        </Link>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setShow(false);
          try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
        }}
        className="ml-auto shrink-0 rounded-[3px] p-1 text-violet-700 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </aside>
  );
}
