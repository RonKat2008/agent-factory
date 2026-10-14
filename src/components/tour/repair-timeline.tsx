import { Loader2 } from "lucide-react";
import type { FeedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { clockTime } from "@/components/time";
import { eventStyle } from "@/components/event-style";

/** Oldest-first vertical timeline; the newest row animates in. */
export function RepairTimeline({ events, startedAt, waiting }: { events: FeedEvent[]; startedAt: number; waiting: boolean }) {
  return (
    <ol className="relative space-y-0 pl-1">
      {events.map((e, i) => {
        const s = eventStyle(e.type);
        const Icon = s.icon;
        const isNewest = i === events.length - 1;
        const at = Math.max(0, Math.round((Date.parse(e.createdAt) - startedAt) / 1000));
        return (
          <li key={e.id} className={cn("relative flex gap-3 pb-3 last:pb-0", isNewest && "feed-row-enter")}>
            {i < events.length - 1 || waiting ? <span aria-hidden className="absolute left-[9px] top-5 h-full w-px bg-stone-300" /> : null}
            <span className="relative z-10 grid size-5 shrink-0 place-items-center rounded-full bg-[#FBFAF7]">
              <Icon className={cn("size-4", s.color, s.spin && "animate-spin")} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[13px] leading-snug text-stone-800", s.emphasis === "repair" && "font-medium", e.type === "needs_human" && "font-bold text-red-700")}>
                {e.message}
              </p>
              <p className="font-mono text-[11px] tabular-nums text-stone-500">
                +{String(at).padStart(2, "0")}s · {clockTime(e.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
      {waiting && (
        <li className="flex items-center gap-3 text-[12px] text-stone-500">
          <Loader2 className="ml-0.5 size-4 animate-spin text-stone-400" aria-hidden />
          Waiting for the next step…
        </li>
      )}
    </ol>
  );
}
