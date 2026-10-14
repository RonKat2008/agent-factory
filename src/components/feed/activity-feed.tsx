"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFeed } from "@/lib/api-client";
import type { EventType, FeedEvent } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fullTime, relTime } from "@/components/time";
import { eventStyle } from "@/components/event-style";
import { LayoutList, Pulse } from "@/components/motion";
import { PANEL } from "@/components/ui-tokens";

const POLL_MS = 3000;

/** What happened, in plain words, as the second half of "<Agent> …". */
const VERB: Record<EventType, string> = {
  built: "was built",
  dry_run: "did a test run",
  test_failed: "failed a check",
  self_fixed: "fixed a problem while testing",
  tests_passed: "passed all its checks",
  went_live: "was turned on",
  run_succeeded: "finished a job",
  run_failed: "had a job fail",
  broke: "broke",
  repairing: "is fixing itself",
  repaired: "fixed itself",
  needs_human: "needs your help",
  edited: "was changed",
  proposed: "suggested a change",
  paused: "was paused",
  resumed: "was resumed",
  approval_needed: "is waiting for your OK",
  feedback: "got feedback",
  triggered: "was started by another agent",
  chain_skipped: "skipped a chained run",
};

const ICON_RING: Record<string, string> = {
  repair: "bg-violet-50 ring-violet-300",
  alarm: "bg-red-50 ring-red-300",
};

function Row({ e, now, showAgent }: { e: FeedEvent; now: number; showAgent: boolean }) {
  const s = eventStyle(e.type);
  const Icon = s.icon;
  const isRepair = e.type === "repaired";
  const icon = (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full bg-[#FBFAF7] ring-1 ring-stone-300",
        s.emphasis && ICON_RING[s.emphasis],
      )}
    >
      <Icon className={cn("size-3.5", s.color, s.spin && "motion-safe:animate-spin")} aria-hidden />
    </span>
  );
  const name = e.agentName ?? "The factory";
  return (
    <div className="relative flex gap-3 py-2.5 pl-1 pr-3">
      <span aria-hidden className="absolute bottom-0 left-[17px] top-0 w-px bg-stone-200" />
      <span className="relative z-10">
        {isRepair ? (
          <Pulse trigger={e.id} tone="violet" radius={999}>
            {icon}
          </Pulse>
        ) : (
          icon
        )}
      </span>
      <div className={cn("min-w-0 flex-1 pt-0.5", isRepair && "border-l-2 border-l-violet-500 pl-2.5")}>
        <p className="text-[14px] leading-snug text-stone-700">
          {showAgent && e.agentId ? (
            <Link href={`/agents/${e.agentId}`} className="font-semibold text-stone-900 hover:underline underline-offset-2">
              {name}
            </Link>
          ) : (
            <span className="font-semibold text-stone-900">{name}</span>
          )}{" "}
          <span className={cn(s.emphasis === "repair" && "text-violet-800", s.emphasis === "alarm" && "font-semibold text-red-700")}>
            {VERB[e.type] ?? e.type.replace(/_/g, " ")}
          </span>
          <time dateTime={e.createdAt} title={fullTime(e.createdAt)} className="ml-2 font-mono text-[11px] tabular-nums text-stone-400">
            {relTime(e.createdAt, now)}
          </time>
        </p>
        {e.message && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-stone-500 [overflow-wrap:anywhere]">{e.message}</p>}
      </div>
    </div>
  );
}

export function ActivityFeed({
  agentId,
  limit = 30,
  title = "What's happening",
}: {
  agentId?: string;
  limit?: number;
  title?: string;
}) {
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const all = await getFeed({ agentId });
        if (!alive) return;
        setEvents([...all].sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt)).slice(0, limit));
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
    <section aria-label={title} className={cn("min-w-0", PANEL)}>
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <h2 className="text-[16px] font-semibold tracking-tight text-stone-900">{title}</h2>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-stone-500">
          <span className="relative size-1.5 rounded-full bg-emerald-500" aria-hidden>
            <span className="absolute inset-0 rounded-full bg-emerald-500 motion-safe:animate-ping" />
          </span>
          Updating live
        </span>
      </header>
      {error && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-1.5 text-[12px] text-red-800">
          Couldn&rsquo;t refresh ({error}). Showing what we saw last.
        </p>
      )}
      {events === null ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 rounded-[3px]" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="px-4 py-8 text-center text-[14px] text-stone-500">
          Quiet so far. When your agents run, break or fix themselves, you&rsquo;ll see it here.
        </p>
      ) : (
        <LayoutList
          as="ol"
          enterFrom="top"
          items={events}
          getKey={(e) => e.id}
          className="max-h-[520px] overflow-y-auto px-3 py-1"
          renderItem={(e) => <Row e={e} now={now} showAgent={!agentId} />}
        />
      )}
    </section>
  );
}
