"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/ui-tokens";
import { NumberTicker } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgents, getStats } from "@/lib/api-client";
import type { Stats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChapterShell, Notice } from "./chapter-shell";
import { GITHUB_URL, friendlyError, markLeavingTour } from "./chapters";

const PRODUCTS: { name: string; does: string }[] = [
  { name: "Workflow DevKit", does: "Every build, run and repair is a durable workflow that retries steps and survives restarts." },
  { name: "Cron", does: "A per-minute tick picks up every agent that is due and starts its run." },
  { name: "AI Gateway", does: "Sonnet builds and repairs agents; Haiku runs their steps and judges their tests." },
  { name: "Sandbox", does: "The run_code block executes in an isolated Firecracker microVM." },
  { name: "eve", does: "Fleet Ops is its own eve agent, and any agent can be exported as an eve project." },
  { name: "BotID and rate limits", does: "Public buttons like this tour's are protected from bots and stampedes." },
  { name: "Analytics and Speed Insights", does: "Real traffic and Core Web Vitals for the app." },
  { name: "Fluid compute", does: "Long AI requests and streams (builds, repairs, Ask Ops) run without cold-start pain." },
  { name: "Neon Postgres", does: "Agents, versions, runs and tests. Local dev runs on a dev branch; production on its own database." },
];

type Numbers = Stats & { costPerRun: number | null };

function useNumbers(): { data: Numbers | null; error: string | null } {
  const [data, setData] = useState<Numbers | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([getStats(), getAgents().catch(() => [])])
      .then(([stats, agents]) => {
        if (!alive) return;
        const runs = agents.reduce((n, a) => n + (a.runs ?? 0), 0);
        const cost = agents.reduce((n, a) => n + (a.costUsd ?? 0), 0);
        setData({ ...stats, costPerRun: runs > 0 ? cost / runs : null });
      })
      .catch((e: unknown) => alive && setError(friendlyError(e)));
    return () => { alive = false; };
  }, []);
  return { data, error };
}

function Stat({ label, value, format }: { label: string; value: number; format: (n: number) => string }) {
  return (
    <div className="min-w-0 border-l-2 border-stone-900 pl-3">
      <p className="font-mono text-[clamp(22px,3vw,30px)] font-semibold leading-none tabular-nums text-stone-900">
        <NumberTicker value={value} from={0} format={format} />
      </p>
      <p className="mt-1.5 text-[12.5px] text-stone-600">{label}</p>
    </div>
  );
}

function HoodTry() {
  const { data, error } = useNumbers();
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-[13.5px] text-stone-700">Live from this deployment right now</p>
        {error ? (
          <Notice tone="red">Live numbers did not load: {error}</Notice>
        ) : !data ? (
          <Skeleton className="h-14 rounded-[3px]" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="runs today" value={data.runsToday} format={(n) => String(Math.round(n))} />
            <Stat label="automatic repairs" value={data.autoRepairs} format={(n) => String(Math.round(n))} />
            <Stat label="total AI cost" value={data.totalCostUsd} format={(n) => `$${n.toFixed(2)}`} />
            {data.costPerRun !== null && <Stat label="average cost per run" value={data.costPerRun * 100} format={(n) => `${n.toFixed(2)}¢`} />}
          </div>
        )}
      </div>
      <ul className="grid gap-px overflow-hidden rounded-[3px] border border-stone-300 bg-stone-300 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => (
          <li key={p.name} className="bg-[#FBFAF7] p-3.5">
            <p className="text-[14px] font-semibold text-stone-900">{p.name}</p>
            <p className="mt-1 text-[13px] leading-snug text-stone-600">{p.does}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={cn(BTN_PRIMARY, "h-10 px-4")}>
          Read the code on GitHub <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
        <Link href="/fleet" onClick={markLeavingTour} className={cn(BTN_SECONDARY, "h-10 px-4")}>
          <Download className="size-3.5" aria-hidden /> Export any agent as an eve project
        </Link>
      </div>
    </div>
  );
}

export function ChapterHood() {
  return (
    <ChapterShell
      n={8}
      title="Under the hood"
      lede={<p>An agent here is not a pile of generated code. It is a small, readable spec over a fixed library of blocks. That is why it can be tested, diffed, repaired and rolled back, and why every Vercel product below has a clear job.</p>}
      different={<p>Delivery is test-gated end to end: builds, edits, repairs and every single post pass the agent&apos;s tests first. A run costs a fraction of a cent, and you can see it.</p>}
      tryIt={<HoodTry />}
      products={["Vercel", "Neon"]}
      hood={<p>Open any agent and use &quot;Export as eve agent&quot; to download it as a standalone eve project you can deploy on your own. The whole app is open source at the GitHub link above.</p>}
    />
  );
}
