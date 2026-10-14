"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

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
    <div className="mb-4 flex items-center gap-3 rounded-[3px] border border-violet-300 bg-violet-50 px-3 py-1.5 text-[13px] text-violet-900">
      <span aria-hidden className="size-1.5 rounded-full bg-violet-600" />
      <span>
        New here?{" "}
        <Link href="/tour" className="font-semibold underline underline-offset-2 hover:text-violet-700">Take the 60-second tour →</Link>
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setShow(false);
          try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
        }}
        className="ml-auto rounded-[3px] p-1 text-violet-700 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
