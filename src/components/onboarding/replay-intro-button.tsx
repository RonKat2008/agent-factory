"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { replayIntro } from "./onboarding-store";

/** Small trigger for the guided intro, for help menus or an empty state ("Show me around"). */
export function ReplayIntroButton({ className, children = "Replay intro" }: { className?: string; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={replayIntro}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-[3px] px-2.5 text-[13px] font-medium text-violet-800 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60",
        className,
      )}
    >
      {children}
    </button>
  );
}
