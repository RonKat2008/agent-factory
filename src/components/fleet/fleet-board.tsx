"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Factory } from "lucide-react";
import { getAgents, getStats } from "@/lib/api-client";
import type { Agent, Stats } from "@/lib/types";
import { BTN_PRIMARY, LABEL } from "@/components/ui-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/components/feed/activity-feed";
import { AgentRow } from "./agent-row";
import { StatStrip } from "./stat-strip";

const POLL_MS = 3000;

export function FleetBoard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
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
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load fleet");
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

  return (
    <div className="space-y-4">
      <StatStrip stats={stats} />
      {error && (
        <p role="alert" className="rounded-[3px] border border-red-300 bg-red-50 px-3 py-2 font-mono text-xs text-red-800">
          Connection problem: {error}. Showing last known data.
        </p>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Agents" className="min-w-0">
          <h2 className={`mb-2 ${LABEL}`}>
            Fleet{agents ? ` · ${agents.length}` : ""}
          </h2>
          {agents === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[72px] rounded-[3px]" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[3px] border border-dashed border-stone-400 bg-[#FBFAF7] px-6 py-14 text-center">
              <Factory className="size-8 text-stone-400" aria-hidden />
              <p className="text-sm text-stone-600">The floor is empty. Describe a job in plain English and the factory builds, tests and runs it.</p>
              <Link
                href="/new"
                className={BTN_PRIMARY}
              >
                Create your first agent
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {agents.map((a) => (
                <AgentRow key={a.id} agent={a} now={now} />
              ))}
            </ul>
          )}
        </section>
        <ActivityFeed limit={40} title="Activity" />
      </div>
    </div>
  );
}
