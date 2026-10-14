"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { getFeed } from "@/lib/api-client";
import type { FeedEvent } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { clockTime, relTime } from "@/components/time";
import { eventStyle } from "@/components/event-style";
import type { EventStyle } from "@/components/event-style";
import { LABEL, PANEL } from "@/components/ui-tokens";

const ROW_BG: Record<NonNullable<EventStyle["emphasis"]>, string> = {
  repair: "bg-violet-50/70 border-l-2 border-l-violet-500",
  alarm: "bg-red-50 border-l-2 border-l-red-600",
};

const POLL_MS = 3000;

export function ActivityFeed({
  agentId,
  limit = 30,
  title = "Activity",
}: {
  agentId?: string;
  limit?: number;
  title?: string;
}) {
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const all = await getFeed({ agentId });
        if (!alive) return;
        const list = [...all]
          .sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt))
          .slice(0, limit);
        const prev = seen.current;
        if (prev) {
          const added = list.filter((e) => !prev.has(e.id)).map((e) => e.id);
          if (added.length) setFresh(new Set(added));
        }
        seen.current = new Set(list.map((e) => e.id));
        setEvents(list);
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Feed unavailable");
      }
      if (alive) setNow(Date.now());
    }
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [agentId, limit]);

  return (
    <section
      aria-label={title}
      className={`min-w-0 ${PANEL}`}
    >
      <header className="flex items-center justify-between border-b border-stone-300 px-3 py-2">
        <h2 className={LABEL}>{title}</h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-stone-500">
          <Radio className="size-3 text-emerald-600" aria-hidden /> live
        </span>
      </header>
      {error && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-3 py-1.5 font-mono text-[11px] text-red-800">
          {error}
        </p>
      )}
      {events === null ? (
        <div className="space-y-2 p-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 rounded-[3px]" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-stone-500">No activity yet.</p>
      ) : (
        <ol className="max-h-[70vh] divide-y divide-stone-200 overflow-y-auto">
          {events.map((e) => {
            const s = eventStyle(e.type);
            const Icon = s.icon;
            return (
              <li
                key={e.id}
                className={cn(
                  "flex gap-2.5 px-3 py-2",
                  s.emphasis && ROW_BG[s.emphasis],
                  fresh.has(e.id) && "feed-row-enter",
                )}
              >
                <Icon
                  className={cn("mt-0.5 size-4 shrink-0", s.color, s.spin && "animate-spin", e.type === "repairing" && "animate-pulse")}
                  aria-label={e.type.replace("_", " ")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <time
                      dateTime={e.createdAt}
                      title={`${new Date(e.createdAt).toLocaleString()} (${relTime(e.createdAt, now)})`}
                      className="font-mono text-[11px] tabular-nums text-stone-500"
                    >
                      {clockTime(e.createdAt)}
                    </time>
                    {e.agentName &&
                      (e.agentId && !agentId ? (
                        <Link
                          href={`/agents/${e.agentId}`}
                          className="truncate text-[12px] font-semibold text-stone-700 hover:underline"
                        >
                          {e.agentName}
                        </Link>
                      ) : (
                        <span className="truncate text-[12px] font-semibold text-stone-700">{e.agentName}</span>
                      ))}
                  </div>
                  <p
                    className={cn(
                      "text-[13px] leading-snug text-stone-800",
                      s.emphasis === "repair" && "font-medium",
                      e.type === "needs_human" && "font-bold text-red-700",
                    )}
                  >
                    {e.message}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
