"use client";

import { useEffect, useState } from "react";
import { getAgents, getStats } from "@/lib/api-client";
import type { Agent, Stats } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/components/feed/activity-feed";
import { FadeIn, LayoutList, STAGGER } from "@/components/motion";
import { AgentCard } from "./agent-card";
import { StatStrip } from "./stat-strip";
import { FleetAnalytics } from "./fleet-analytics";
import { FleetEmpty } from "./fleet-empty";

const POLL_MS = 3000;
const GRID = "grid gap-4 md:grid-cols-2 xl:grid-cols-3";

export function FleetBoard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [firstIds, setFirstIds] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [s, a] = await Promise.all([getStats(), getAgents()]);
        if (!alive) return;
        setStats(s);
        setAgents(a);
        setFirstIds((ids) => ids ?? a.map((x) => x.id));
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load your agents");
      }
      if (alive) setNow(Date.now());
    }
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  /** Cards present on first load rise in one after another; later arrivals use LayoutList's entrance. */
  const entranceDelay = (id: string) => {
    const i = firstIds?.indexOf(id) ?? -1;
    return i < 0 ? null : i * STAGGER.normal;
  };

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-[15px] font-semibold text-stone-900">My agents</h1>
          <p className="text-[13px] text-stone-500">Everything you&rsquo;ve built, and whether it&rsquo;s working right now.</p>
        </div>
        <StatStrip stats={stats} />
        {error && (
          <p role="alert" className="rounded-[3px] border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800">
            Can&rsquo;t reach Pitcrew right now ({error}). Showing what we saw last.
          </p>
        )}
      </header>

      <section aria-label="Your agents" data-tour="fleet-agents">
        {agents === null ? (
          <div className={GRID}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[300px] rounded-[4px]" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <FleetEmpty />
        ) : (
          <LayoutList
            items={agents}
            getKey={(a) => a.id}
            className={GRID}
            itemClassName="flex"
            renderItem={(a) => {
              const delay = entranceDelay(a.id);
              const card = <AgentCard agent={a} now={now} />;
              return delay == null ? card : (
                <FadeIn delay={delay} y={14} className="flex w-full">
                  {card}
                </FadeIn>
              );
            }}
          />
        )}
      </section>

      <div className="max-w-[760px]">
        <ActivityFeed limit={25} title="What's happening" />
      </div>

      {agents && agents.length > 0 && <FleetAnalytics agents={agents} now={now} />}
    </div>
  );
}
