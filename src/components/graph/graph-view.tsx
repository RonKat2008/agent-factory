"use client";

import { Network } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GraphCanvas } from "./graph-canvas";
import { GraphLegend } from "./graph-legend";
import { GraphPanel } from "./graph-panel";
import type { GraphResponse } from "./types";

const POLL_MS = 3000;

async function fetchGraph(): Promise<GraphResponse> {
  const res = await fetch("/api/graph", { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as Partial<GraphResponse> & { error?: string };
  if (!res.ok || !body.nodes) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body as GraphResponse;
}

export function GraphView() {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const g = await fetchGraph();
        if (!alive) return;
        setGraph(g);
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load the graph");
      }
    };
    void load();
    const id = setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const counts = useMemo(() => {
    const n = graph?.nodes ?? [];
    return {
      agents: n.filter((x) => x.type === "agent").length,
      chains: (graph?.edges ?? []).filter((e) => e.type === "trigger").length,
      entities: n.filter((x) => x.type === "entity").length,
      connectors: n.filter((x) => x.type === "connector").length,
    };
  }, [graph]);

  const select = useCallback((id: string | null) => setSelectedId(id), []);
  const selected = graph?.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-stone-900">Graph</h1>
        <p className="font-mono text-[12px] tabular-nums text-stone-600" aria-live="polite">
          {graph
            ? `${counts.agents} agents · ${counts.chains} chains · ${counts.entities} entities · ${counts.connectors} connectors`
            : "loading…"}
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-[3px] border border-red-200 bg-red-50 px-3 py-1.5 text-[13px] text-red-800">
          Graph update failed: {error}. Showing the last good data.
        </p>
      ) : null}

      <div className="relative flex h-[calc(100dvh-11rem)] min-h-[420px] overflow-hidden rounded-[3px] border border-stone-300 bg-[#FBFAF7] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="relative min-w-0 flex-1">
          <GraphCanvas graph={graph} selectedId={selected?.id ?? null} onSelect={select} />
          <GraphLegend />
          {graph && graph.nodes.length === 0 ? (
            <Overlay title="No agents yet" body="Create an agent and it will appear here." />
          ) : null}
          {graph && counts.entities === 0 && graph.nodes.length > 0 ? (
            <div className="pointer-events-none absolute inset-x-3 top-3 max-w-[340px] rounded-[3px] border border-stone-300 bg-[#FBFAF7]/95 p-3 text-[13px] text-stone-700 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
              <p className="font-medium text-stone-900">No entities yet</p>
              <p className="mt-0.5 text-stone-600">As agents post, the companies, products and people they mention show up here, linked to the agents that found them.</p>
            </div>
          ) : null}
          {!graph ? <div className="absolute inset-0 animate-pulse bg-stone-200/40 motion-reduce:animate-none" aria-hidden /> : null}
        </div>
        {selected && graph ? <GraphPanel key={selected.id} node={selected} graph={graph} onClose={() => setSelectedId(null)} /> : null}
      </div>
    </div>
  );
}

function Overlay({ title, body }: { title: string; body: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
      <Network className="size-7 text-stone-400" aria-hidden />
      <p className="text-[15px] font-medium text-stone-900">{title}</p>
      <p className="max-w-xs text-[13px] text-stone-600">{body}</p>
    </div>
  );
}
