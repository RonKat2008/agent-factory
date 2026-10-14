"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { FeedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { clockTime } from "@/components/time";
import { eventStyle } from "@/components/event-style";
import { DURATION, EASE, LayoutList, Pulse } from "@/components/motion";

/** Fires its ring once, right after the row mounts (Pulse itself ignores the initial value). */
function PulseOnMount({ children }: { children: React.ReactNode }) {
  const [armed, setArmed] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setArmed(1), 60);
    return () => clearTimeout(t);
  }, []);
  return (
    <Pulse trigger={armed} tone="emerald" radius={999}>
      {children}
    </Pulse>
  );
}

/** Oldest-first vertical timeline; each step slides up as the API delivers it. */
export function RepairTimeline({ events, startedAt, waiting }: { events: FeedEvent[]; startedAt: number; waiting: boolean }) {
  return (
    <div>
      <LayoutList
        as="ol"
        enterFrom="bottom"
        className="relative pl-1"
        items={events}
        getKey={(e) => e.id}
        renderItem={(e, i) => {
          const s = eventStyle(e.type);
          const Icon = s.icon;
          const at = Math.max(0, Math.round((Date.parse(e.createdAt) - startedAt) / 1000));
          const hasNext = i < events.length - 1 || waiting;
          const icon = <Icon className={cn("size-4", s.color, s.spin && "animate-spin")} aria-hidden />;
          return (
            <div className="relative flex gap-3 pb-3">
              {hasNext && (
                <motion.span
                  aria-hidden
                  className="absolute left-[9px] top-5 h-[calc(100%-8px)] w-px origin-top bg-stone-300"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: DURATION.normal, ease: EASE.out }}
                />
              )}
              <span className="relative z-10 grid size-5 shrink-0 place-items-center rounded-full bg-[#FBFAF7]">
                {e.type === "tests_passed" ? <PulseOnMount>{icon}</PulseOnMount> : icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px] leading-snug text-stone-800", s.emphasis === "repair" && "font-medium", e.type === "needs_human" && "font-bold text-red-700")}>
                  {e.message}
                </p>
                <p className="font-mono text-[11px] tabular-nums text-stone-500">
                  +{String(at).padStart(2, "0")}s · {clockTime(e.createdAt)}
                </p>
              </div>
            </div>
          );
        }}
      />
      {waiting && (
        <p className="flex items-center gap-3 pl-1 text-[12px] text-stone-500">
          <Loader2 className="ml-0.5 size-4 animate-spin text-stone-400" aria-hidden />
          Waiting for the next step…
        </p>
      )}
    </div>
  );
}
