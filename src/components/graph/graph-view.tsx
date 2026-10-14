"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Term } from "@/components/explain";
import { DURATION, EASE, SPRING } from "@/components/motion/tokens";
import { BTN_PRIMARY, FOCUS } from "@/components/ui-tokens";
import { cn } from "@/lib/utils";
import { FlowView } from "./flow-view";
import { GraphCanvas } from "./graph-canvas";
import { GraphLegend } from "./graph-legend";
import { GraphPanel } from "./graph-panel";
import type { GraphResponse } from "./types";

const POLL_MS = 3000;
const FRESH_PULSE_MS = 8000;
type Mode = "flow" | "knowledge";

async function fetchGraph(): Promise<GraphResponse> {
  const res = await fetch("/api/graph", { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as Partial<GraphResponse> & { error?: string };
  if (!res.ok || !body.nodes) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body as GraphResponse;
}

const STAGE_BG = {
  backgroundImage:
    "radial-gradient(60% 50% at 18% 0%, rgba(124,58,237,0.16), transparent 70%), radial-gradient(50% 45% at 100% 100%, rgba(14,165,233,0.10), transparent 70%), radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
  backgroundSize: "auto, auto, 26px 26px",
} as const;

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "flow", label: "Flow", hint: "Where information comes from and goes" },
  { id: "knowledge", label: "Knowledge", hint: "What your agents have learned" },
];

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div role="radiogroup" aria-label="Map view" className="inline-flex rounded-[8px] border border-stone-300 bg-[#FBFAF7] p-0.5">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={mode === m.id}
          title={m.hint}
          onClick={() => onChange(m.id)}
          className={cn("relative h-8 rounded-[6px] px-3.5 text-[13px] font-medium transition-colors", FOCUS, mode === m.id ? "text-[#F6F4EF]" : "text-stone-600 hover:text-stone-900")}
        >
          {mode === m.id && <motion.span layoutId="graph-mode" className="absolute inset-0 rounded-[6px] bg-stone-900" transition={SPRING.snappy} />}
          <span className="relative">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

function EmptyStage() {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <svg width="160" height="72" viewBox="0 0 160 72" fill="none" aria-hidden>
          <circle cx="24" cy="36" r="14" stroke="#a8a29e" strokeWidth="2" />
          <circle cx="136" cy="36" r="14" stroke="#a8a29e" strokeWidth="2" />
          <path d="M40 36h80" stroke="#a78bfa" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" />
          <circle cx="80" cy="36" r="3.5" fill="#a78bfa" />
        </svg>
        <p className="text-[17px] font-semibold text-stone-50">Your agents will connect here</p>
        <p className="text-[14px] leading-relaxed text-stone-400">Agents that feed each other show up here. Build two agents and link them.</p>
        <Link href="/" className={cn(BTN_PRIMARY, "h-11 bg-stone-100 px-5 text-[15px] text-stone-900 hover:bg-white")}>
          Build an agent
        </Link>
      </div>
    </div>
  );
}

export function GraphView() {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("flow");
  const [fires, setFires] = useState<Record<string, number>>({});
  const seenPulses = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const g = await fetchGraph();
        if (!alive) return;
        // a chain firing: replay its animation once per new pulse, never for old ones on load
        const fresh: string[] = [];
        for (const p of g.pulses) {
          const key = `${p.edgeId}@${p.at}`;
          if (seenPulses.current.has(key)) continue;
          seenPulses.current.add(key);
          const age = Date.now() - new Date(p.at).getTime();
          if (age >= -2000 && age < FRESH_PULSE_MS) fresh.push(p.edgeId.replace(/^trigger:/, ""));
        }
        if (fresh.length) {
          setFires((prev) => {
            const next = { ...prev };
            for (const id of fresh) next[id] = (next[id] ?? 0) + 1;
            return next;
          });
        }
        setGraph(g);
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load the map");
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
      sources: n.filter((x) => x.type === "connector").length,
    };
  }, [graph]);

  // Knowledge view: agents and what they've learned. Connectors belong to the flow view.
  const knowledge = useMemo<GraphResponse | null>(() => {
    if (!graph) return null;
    const nodes = graph.nodes.filter((n) => n.type !== "connector");
    const ids = new Set(nodes.map((n) => n.id));
    return { ...graph, nodes, edges: graph.edges.filter((e) => e.type !== "uses" && ids.has(e.source) && ids.has(e.target)) };
  }, [graph]);

  const select = useCallback((id: string | null) => setSelectedId(id), []);
  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setSelectedId(null);
  }, []);
  const selected = graph?.nodes.find((n) => n.id === selectedId) ?? null;
  const noAgents = graph !== null && counts.agents === 0;

  return (
    <div className="space-y-5 py-2">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="space-y-1.5">
          <h1 className="t-title text-[28px]">How your agents connect</h1>
          <p className="max-w-[64ch] text-[15px] leading-relaxed text-stone-600">
            Each agent reads from a few places, does its job, then posts the result. When one agent triggers another, you will see a purple link between them (a <Term id="chain">chain</Term>).
          </p>
          <p className="font-mono text-[12px] tabular-nums text-stone-500" aria-live="polite">
            {graph ? `${counts.agents} agents · ${counts.chains} chains · ${counts.sources} sources · ${counts.entities} things learned` : "loading…"}
          </p>
        </div>
        <ModeSwitch mode={mode} onChange={switchMode} />
      </header>

      {error ? (
        <p role="alert" className="rounded-[3px] border border-red-200 bg-red-50 px-3 py-1.5 text-[13px] text-red-800">
          Update failed: {error}. Showing the last good data.
        </p>
      ) : null}

      <div
        style={STAGE_BG}
        className="relative flex h-[calc(100dvh-15rem)] min-h-[520px] overflow-hidden rounded-[16px] border border-stone-800 bg-[#0E0E10] shadow-[0_24px_60px_-28px_rgba(14,14,16,0.7)]"
      >
        <div className="relative min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={noAgents ? "empty" : mode}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.normal, ease: EASE.out }}
            >
              {!graph ? (
                <div className="absolute inset-0 animate-pulse bg-white/[0.03] motion-reduce:animate-none" aria-hidden />
              ) : noAgents ? (
                <EmptyStage />
              ) : mode === "flow" ? (
                <FlowView graph={graph} selectedId={selected?.id ?? null} onSelect={select} fires={fires} />
              ) : (
                <>
                  <GraphCanvas graph={knowledge} selectedId={selected?.id ?? null} onSelect={select} />
                  <GraphLegend />
                  {counts.entities === 0 ? (
                    <div className="pointer-events-none absolute inset-x-3 top-3 max-w-[340px] rounded-[10px] border border-white/10 bg-[#17171a]/95 p-3 text-[13px] text-stone-300">
                      <p className="font-medium text-stone-100">Nothing learned yet</p>
                      <p className="mt-0.5 text-stone-400">As agents post, the companies, products and people they mention show up here, linked to the agents that found them.</p>
                    </div>
                  ) : null}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        {selected && graph ? <GraphPanel key={selected.id} node={selected} graph={graph} onClose={() => setSelectedId(null)} /> : null}
      </div>
    </div>
  );
}
