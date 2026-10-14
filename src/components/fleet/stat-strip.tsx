"use client";

import type { ReactNode } from "react";
import type { Stats } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { NumberTicker, Pulse } from "@/components/motion";
import { Term } from "@/components/explain";

const int = (n: number) => Math.round(n).toLocaleString();
const usd = (n: number) => `$${n < 0.1 ? n.toFixed(4) : n.toFixed(2)}`;
const times = (n: number) => `${Math.round(n)}×`;

/** A number inside the hero sentence: mono, counts up from 0 on first load. */
function Num({ value, format, tone = "text-stone-900" }: { value: number; format: (n: number) => string; tone?: string }) {
  return (
    <span className={cn("font-mono font-semibold", tone)}>
      <NumberTicker value={value} from={0} format={format} />
    </span>
  );
}

function Sentence({ stats }: { stats: Stats }) {
  const live = stats.agentsLive;
  const agents = live === 1 ? "agent is" : "agents are";
  return (
    <p className="max-w-[34ch] text-[26px] font-medium leading-[1.25] tracking-tight text-stone-500 sm:max-w-[42ch] sm:text-[32px]">
      {live > 0 ? (
        <>
          <span className="text-stone-900">
            <Num value={live} format={int} /> {agents}
          </span>{" "}
          working for you.
        </>
      ) : (
        <>None of your agents are running right now.</>
      )}{" "}
      Today they&rsquo;ve done <Num value={stats.runsToday} format={int} /> {stats.runsToday === 1 ? "job" : "jobs"}
      {stats.autoRepairs > 0 ? (
        <>
          , fixed themselves <Num value={stats.autoRepairs} format={times} tone="text-violet-700" />
        </>
      ) : null}
      , and cost <Num value={stats.totalCostUsd} format={usd} /> in total.
    </p>
  );
}

function Tile({ label, children, accent }: { label: ReactNode; children: ReactNode; accent?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 py-2 sm:py-0">
      <dt className={cn("text-[13px]", accent ? "text-violet-800" : "text-stone-500")}>{label}</dt>
      <dd className={cn("order-first font-mono text-[18px] font-semibold tabular-nums", accent ? "text-violet-700" : "text-stone-900")}>
        {children}
      </dd>
    </div>
  );
}

/** Hero summary sentence plus a slim strip of the same totals in plain words. */
export function StatStrip({ stats }: { stats: Stats | null }) {
  if (!stats) {
    return (
      <section aria-label="Your agents at a glance" className="space-y-3">
        <Skeleton className="h-9 w-full max-w-xl rounded-[3px]" />
        <Skeleton className="h-9 w-3/4 max-w-md rounded-[3px]" />
        <Skeleton className="h-6 w-full max-w-lg rounded-[3px]" />
      </section>
    );
  }
  return (
    <section aria-label="Your agents at a glance" className="space-y-5">
      <Sentence stats={stats} />
      <dl className="grid grid-cols-2 gap-x-6 border-y border-stone-300 py-2 sm:flex sm:flex-wrap sm:gap-x-10 sm:py-3">
        <Tile label="working now">
          <NumberTicker value={stats.agentsLive} format={int} />
        </Tile>
        <Tile
          label={
            <>
              <Term id="run">jobs</Term> done today
            </>
          }
        >
          <NumberTicker value={stats.runsToday} format={int} />
        </Tile>
        <Tile
          accent
          label={
            <Term id="repair" className="text-violet-800">
              fixed themselves
            </Term>
          }
        >
          <Pulse tone="violet" trigger={stats.autoRepairs} radius={3}>
            <NumberTicker value={stats.autoRepairs} format={int} />
          </Pulse>
        </Tile>
        <Tile
          label={
            <>
              <Term id="cost">spent</Term> so far
            </>
          }
        >
          <NumberTicker value={stats.totalCostUsd} format={usd} />
        </Tile>
      </dl>
    </section>
  );
}
