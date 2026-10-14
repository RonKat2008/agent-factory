"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  FlaskConical,
  Hammer,
  Hand,
  Loader2,
  Pencil,
  Radio,
  Rocket,
  ShieldCheck,
  ThumbsUp,
  Wrench,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getFeed } from "@/lib/api-client";
import type { EventType, FeedEvent } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { clockTime, relTime } from "@/components/fleet/time";

type Style = { icon: LucideIcon; color: string; spin?: boolean; emphasis?: "repair" | "alarm" };

const EMERALD = "text-emerald-600";
const STYLES: Record<EventType, Style> = {
  broke: { icon: XCircle, color: "text-red-600", emphasis: "repair" },
  repairing: { icon: Loader2, color: "text-amber-600", spin: true, emphasis: "repair" },
  repaired: { icon: Wrench, color: "text-violet-600", emphasis: "repair" },
  test_failed: { icon: XCircle, color: "text-red-600" },
  self_fixed: { icon: Zap, color: "text-violet-600" },
  tests_passed: { icon: ShieldCheck, color: EMERALD },
  run_succeeded: { icon: CheckCircle2, color: EMERALD },
  went_live: { icon: Rocket, color: EMERALD },
  run_failed: { icon: XCircle, color: "text-red-600" },
  feedback: { icon: ThumbsUp, color: "text-stone-600" },
  paused: { icon: CirclePause, color: "text-stone-500" },
  resumed: { icon: CirclePlay, color: "text-stone-500" },
  approval_needed: { icon: Hand, color: "text-amber-600" },
  needs_human: { icon: AlertTriangle, color: "text-red-600", emphasis: "alarm" },
  built: { icon: Hammer, color: "text-stone-600" },
  dry_run: { icon: FlaskConical, color: "text-stone-600" },
  edited: { icon: Pencil, color: "text-stone-600" },
  proposed: { icon: Pencil, color: "text-violet-600" },
};

const ROW_BG: Record<NonNullable<Style["emphasis"]>, string> = {
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
      className="min-w-0 rounded-[3px] border border-stone-300 bg-[#FBFAF7] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
    >
      <header className="flex items-center justify-between border-b border-stone-300 px-3 py-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500">{title}</h2>
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
            const s = STYLES[e.type] ?? STYLES.built;
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
