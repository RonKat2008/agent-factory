"use client";
import { useEffect, useState } from "react";
import { getFeed } from "@/lib/api-client";
import type { FeedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LABEL, fullTime, relTime } from "./format";
import { eventStyle } from "@/components/event-style";

export function AgentEvents({ agentId }: { agentId: string }) {
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getFeed({ agentId })
        .then((e) => {
          if (!alive) return;
          setEvents(e);
          setError(null);
        })
        .catch((err: Error) => alive && setError(err.message));
    load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [agentId]);

  return (
    <section aria-label="Agent events" className="flex flex-col gap-2">
      <h2 className={LABEL}>Events</h2>
      {error && (
        <p className="text-[12px] text-red-700">Feed unavailable: {error}</p>
      )}
      {events === null && !error && (
        <div
          className="flex flex-col gap-2"
          aria-busy="true"
          aria-label="Loading events"
        >
          <div className="h-8 animate-pulse rounded-[3px] bg-stone-200/70" />
          <div className="h-8 animate-pulse rounded-[3px] bg-stone-200/70" />
        </div>
      )}
      {events !== null && events.length === 0 && (
        <p className="text-[13px] text-stone-500">No events yet</p>
      )}
      {events !== null && events.length > 0 && (
        <ol className="flex max-h-[320px] flex-col overflow-y-auto">
          {events?.map((e) => {
            const s = eventStyle(e.type);
            const Icon = s.icon;
            return (
              <li
                key={e.id}
                className={cn(
                  "border-l-2 py-1.5 pl-2.5 motion-safe:animate-in motion-safe:fade-in",
                  s.tone,
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide">
                    <Icon
                      className={cn(
                        "size-3",
                        s.color,
                        s.spin && "animate-spin",
                      )}
                      aria-hidden
                    />
                    {e.type.replace(/_/g, " ")}
                  </span>
                  <span
                    className="font-mono text-[10px] tabular-nums text-stone-500"
                    title={fullTime(e.createdAt)}
                  >
                    {relTime(e.createdAt)}
                  </span>
                </div>
                <p className="text-[12px] leading-snug text-stone-800">
                  {e.message}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
