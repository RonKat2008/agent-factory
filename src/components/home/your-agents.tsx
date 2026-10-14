"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { getAgents } from "@/lib/api-client";
import type { Agent } from "@/lib/types";
import { relTime, fullTime } from "@/components/time";
import { humanSchedule } from "@/components/create/schedule";
import { STATUS_WORDS, plainPreview } from "@/components/create/plain";
import { cn } from "@/lib/utils";

const POLL_MS = 5000;
const MAX_ROWS = 12;

function AgentLine({ agent }: { agent: Agent }) {
  const s = STATUS_WORDS[agent.status];
  const last = agent.lastOutput;
  return (
    <li>
      <Link
        href={`/agents/${agent.id}`}
        className="group grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 px-4 py-3.5 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-600/60 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto]"
      >
        <div className="col-start-1 row-start-1 min-w-0">
          <p className="truncate text-[15px] font-medium text-stone-900">{agent.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-stone-500">
            <span className="inline-flex items-center gap-1.5 text-stone-800">
              <span className={cn("size-2 rounded-full", s.dot)} aria-hidden />
              {s.text}
            </span>
            <span aria-hidden>·</span>
            <span>{humanSchedule(agent.schedule)}</span>
          </p>
        </div>
        <p className="col-span-2 col-start-1 row-start-2 min-w-0 text-[13px] leading-snug text-stone-600 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          {last ? (
            <>
              <span className="line-clamp-2">“{plainPreview(last.message)}”</span>
              <span className="mt-0.5 block text-[12px] text-stone-400" title={fullTime(last.at)}>
                sent {relTime(last.at)}
              </span>
            </>
          ) : (
            <span className="text-stone-400">No messages sent yet</span>
          )}
        </p>
        <ChevronRight className="col-start-2 row-start-1 mt-1 size-4 sm:col-start-3 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-stone-900" aria-hidden />
      </Link>
    </li>
  );
}

export function YourAgents() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const list = await getAgents();
        if (alive) {
          setAgents(list);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Couldn't load your agents");
      }
    };
    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // The API lists oldest first; people want their newest agent on top.
  const shown = [...(agents ?? [])].reverse().slice(0, MAX_ROWS);

  return (
    <section aria-labelledby="your-agents" className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="your-agents" className="text-[20px] font-semibold tracking-[-0.01em] text-stone-900">
          Your agents
        </h2>
        <Link href="/fleet" className="text-[13px] text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline">
          Open the fleet dashboard
        </Link>
      </div>
      {error && !agents && (
        <p role="alert" className="mt-3 text-[13px] text-red-700">
          Couldn’t load your agents: {error}
        </p>
      )}
      <div className="mt-3 overflow-hidden rounded-[4px] border border-stone-300 bg-[#FBFAF7]">
        {agents === null && !error ? (
          <ul aria-busy="true" aria-label="Loading agents" className="divide-y divide-stone-200">
            {[0, 1, 2].map((i) => (
              <li key={i} className="px-4 py-4">
                <div className="h-4 w-1/3 animate-pulse rounded-[2px] bg-stone-200" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded-[2px] bg-stone-200/70" />
              </li>
            ))}
          </ul>
        ) : shown.length === 0 ? (
          <p className="px-4 py-6 text-[14px] text-stone-600">No agents yet. Pick an example above to build your first one.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {shown.map((a) => (
              <AgentLine key={a.id} agent={a} />
            ))}
          </ul>
        )}
      </div>
      {agents && agents.length > MAX_ROWS && (
        <p className="mt-2 text-[13px] text-stone-500">
          Showing {MAX_ROWS} of {agents.length}.{" "}
          <Link href="/fleet" className="underline underline-offset-2 hover:text-stone-900">
            See them all
          </Link>
        </p>
      )}
    </section>
  );
}
