"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { BTN_SECONDARY } from "@/components/ui-tokens";
import { FlowView } from "@/components/graph/flow-view";
import type { GraphResponse } from "@/components/graph/types";
import { cn } from "@/lib/utils";
import { ChapterShell, Notice } from "./chapter-shell";
import { friendlyError, markLeavingTour } from "./chapters";

const POLL_MS = 5000;
const NO_FIRES: Record<string, number> = {};

async function fetchGraph(): Promise<GraphResponse> {
  const res = await fetch("/api/graph", { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as Partial<GraphResponse> & { error?: string };
  if (!res.ok || !body.nodes) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body as GraphResponse;
}

function CompactGraph() {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchGraph()
        .then((g) => { if (alive) { setGraph(g); setError(null); } })
        .catch((e: unknown) => { if (alive) setError(friendlyError(e)); });
    void load();
    const t = setInterval(() => { if (!document.hidden) void load(); }, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="space-y-3">
      {error && !graph && <Notice tone="red">The map did not load: {error}</Notice>}
      <div className="relative h-[460px] overflow-hidden rounded-[12px] border border-stone-800 bg-[#0E0E10]">
        {graph ? (
          <div className="absolute inset-0">
            <FlowView graph={graph} selectedId={selectedId} onSelect={setSelectedId} fires={NO_FIRES} />
          </div>
        ) : (
          <div className="absolute inset-0 animate-pulse bg-white/[0.03] motion-reduce:animate-none" aria-hidden />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/graph" onClick={markLeavingTour} className={cn(BTN_SECONDARY, "h-9")}>
          Open the full graph <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
        <p className="text-[13px] text-stone-500">Hover an agent to light up its path. The full page also has a Knowledge view of everything the fleet has learned.</p>
      </div>
    </div>
  );
}

export function ChapterGraph() {
  return (
    <ChapterShell
      n={4}
      title="See the whole system"
      lede={
        <p>
          Every agent reads from a few sources, does its job, and posts somewhere. This map shows all of it live: sources on the left, agents in the middle, destinations on the right, and the purple links where one agent triggers another.
        </p>
      }
      different={
        <p>
          You are not looking at a diagram someone drew. It is generated from the agents&apos; real plans and run history, and it updates as agents run, so a chain firing lights up here as it happens.
        </p>
      }
      tryIt={<CompactGraph />}
      products={["Neon", "Fluid compute"]}
      hood={
        <p>
          The graph API builds nodes and edges from each agent&apos;s current version (which blocks and connectors it uses), its chain triggers, and the entities its posts mention, all stored in Neon Postgres. The page polls it every few seconds; the API runs on Vercel Fluid compute.
        </p>
      }
    />
  );
}
