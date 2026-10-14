"use client";
import { useEffect, useState } from "react";
import { getFeed } from "@/lib/api-client";
import type { EventType, FeedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LABEL, fullTime, relTime } from "./format";

const TONE: Partial<Record<EventType, string>> = {
  broke: "border-red-600 text-red-800",
  test_failed: "border-red-600 text-red-800",
  run_failed: "border-red-600 text-red-800",
  needs_human: "border-red-600 text-red-800",
  repairing: "border-amber-600 text-amber-800",
  approval_needed: "border-amber-600 text-amber-800",
  repaired: "border-violet-600 text-violet-800",
  self_fixed: "border-violet-600 text-violet-800",
  proposed: "border-violet-600 text-violet-800",
  tests_passed: "border-emerald-600 text-emerald-800",
  run_succeeded: "border-emerald-600 text-emerald-800",
  went_live: "border-emerald-600 text-emerald-800",
};

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
      {error && <p className="text-[12px] text-red-700">Feed unavailable: {error}</p>}
      {events === null && !error && <div className="h-16 animate-pulse rounded-[3px] bg-stone-200/70" />}
      {events?.length === 0 && <p className="text-[13px] text-stone-500">No events yet.</p>}
      <ol className="flex max-h-[320px] flex-col overflow-y-auto">
        {events?.map((e) => (
          <li
            key={e.id}
            className={cn(
              "border-l-2 py-1.5 pl-2.5 motion-safe:animate-in motion-safe:fade-in",
              TONE[e.type] ?? "border-stone-300 text-stone-700",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wide">{e.type.replace(/_/g, " ")}</span>
              <span className="font-mono text-[10px] tabular-nums text-stone-500" title={fullTime(e.createdAt)}>
                {relTime(e.createdAt)}
              </span>
            </div>
            <p className="text-[12px] leading-snug text-stone-800">{e.message}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
