"use client";

import { ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";
import { kindColor } from "./palette";
import type { GraphNodeDto, GraphResponse } from "./types";

type Mention = { agentId: string; url: string | null; snippet: string | null; createdAt: string };

function ago(iso?: string | null): string {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500">{children}</p>;
}

function AgentLink({ node }: { node: GraphNodeDto }) {
  return (
    <Link
      href={`/agents/${node.id}`}
      className="inline-flex items-center gap-1 rounded-[3px] border border-white/10 bg-white/5 px-1.5 py-0.5 text-[13px] text-stone-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
    >
      {node.label}
    </Link>
  );
}

function useMentions(node: GraphNodeDto | null): Mention[] | null {
  const entityUuid = node?.type === "entity" ? node.id.replace(/^entity:/, "") : null;
  const [state, setState] = useState<{ id: string; items: Mention[] } | null>(null);
  useEffect(() => {
    if (!entityUuid) return;
    let alive = true;
    fetch(`/api/graph/entity/${entityUuid}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { mentions: [] }))
      .then((b: { mentions?: Mention[] }) => alive && setState({ id: entityUuid, items: b.mentions ?? [] }))
      .catch(() => alive && setState({ id: entityUuid, items: [] }));
    return () => {
      alive = false;
    };
  }, [entityUuid]);
  return state && state.id === entityUuid ? state.items : null;
}

export function GraphPanel({ node, graph, onClose }: { node: GraphNodeDto; graph: GraphResponse; onClose: () => void }) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const linked = (pick: (e: GraphResponse["edges"][number]) => string | null, type?: string) =>
    graph.edges
      .filter((e) => !type || e.type === type)
      .map(pick)
      .filter((id): id is string => !!id)
      .map((id) => byId.get(id))
      .filter((n): n is GraphNodeDto => !!n);

  const upstream = linked((e) => (e.type === "trigger" && e.target === node.id ? e.source : null));
  const downstream = linked((e) => (e.type === "trigger" && e.source === node.id ? e.target : null));
  const mentionedBy = linked((e) => (e.type === "mention" && e.target === node.id ? e.source : null));
  const usedBy = linked((e) => (e.type === "uses" && e.target === node.id ? e.source : null));
  const entities = linked((e) => (e.type === "mention" && e.source === node.id ? e.target : null));
  const uses = linked((e) => (e.type === "uses" && e.source === node.id ? e.target : null));
  const mentions = useMentions(node);

  return (
    <aside
      aria-label={`${node.label} details`}
      className={cn(
        "z-10 flex min-h-0 flex-col border-white/10 bg-[#141416]",
        // mobile bottom sheet, desktop side column
        "absolute inset-x-0 bottom-0 max-h-[58%] rounded-t-[6px] border-t shadow-[0_-8px_24px_rgba(0,0,0,0.4)]",
        "md:static md:max-h-none md:w-[340px] md:shrink-0 md:rounded-none md:border-l md:border-t-0 md:shadow-none",
        "animate-in slide-in-from-bottom-4 md:slide-in-from-right-4 duration-200 motion-reduce:animate-none",
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          <Label>{node.type === "entity" ? `Entity · ${node.kind ?? "other"}` : node.type}</Label>
          <h2 className="mt-1 flex items-center gap-2 text-[17px] font-semibold leading-tight text-stone-100">
            {node.type === "entity" ? <span className="size-2.5 shrink-0 rounded-full" style={{ background: kindColor(node.kind) }} aria-hidden /> : null}
            <span className="break-words">{node.label}</span>
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="-m-1 rounded-[3px] p-1 text-stone-500 hover:bg-white/10 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-[13px] text-stone-300">
        {node.type === "agent" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {node.status ? <StatusPill status={node.status} /> : null}
              {node.meta?.version != null ? <span className="font-mono tabular-nums text-stone-400">v{node.meta.version}</span> : null}
            </div>
            <dl className="grid grid-cols-3 gap-3">
              <Stat label="Health" value={node.meta?.health != null ? String(node.meta.health) : "–"} />
              <Stat label="Runs" value={String(node.weight)} />
              <Stat label="Last run" value={ago(node.meta?.lastRunAt)} small />
            </dl>
            {node.meta?.does ? <p className="leading-relaxed text-stone-200">{node.meta.does}</p> : null}
            {node.meta?.schedule ? <p className="text-stone-500">{node.meta.schedule}</p> : null}
            <section className="space-y-1.5">
              <Label>Last output</Label>
              {node.meta?.lastOutput ? (
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-[3px] border border-white/10 bg-white/5 p-2.5 leading-relaxed text-stone-200">{node.meta.lastOutput}</p>
              ) : (
                <p className="text-stone-500">Nothing posted yet.</p>
              )}
            </section>
            <NodeList title="Triggered by" nodes={upstream} render={(n) => <AgentLink key={n.id} node={n} />} />
            <NodeList title="Triggers" nodes={downstream} render={(n) => <AgentLink key={n.id} node={n} />} />
            <NodeList title="Uses" nodes={uses} render={(n) => <Chip key={n.id}>{n.label}</Chip>} />
            <p className="font-mono text-[12px] tabular-nums text-stone-500">{entities.length} entities mentioned</p>
            <Link
              href={`/agents/${node.id}`}
              className="inline-flex items-center gap-1.5 rounded-[3px] bg-stone-100 px-3 py-1.5 text-[13px] font-medium text-stone-900 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
            >
              Open agent <ArrowUpRight className="size-3.5" />
            </Link>
          </>
        ) : null}

        {node.type === "entity" ? (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Mentions" value={String(node.weight)} />
              <Stat label="Last seen" value={ago(node.meta?.lastSeen)} small />
            </dl>
            <NodeList title="Mentioned by" nodes={mentionedBy} render={(n) => <AgentLink key={n.id} node={n} />} />
            <section className="space-y-1.5">
              <Label>Sources</Label>
              {mentions === null ? (
                <div className="h-14 animate-pulse rounded-[3px] bg-white/10 motion-reduce:animate-none" />
              ) : mentions.length === 0 ? (
                <p className="text-stone-500">No source links recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {mentions.map((m, i) => (
                    <li key={`${m.createdAt}-${i}`} className="border-l-2 border-white/10 pl-2.5">
                      <p className="flex items-center gap-2 font-mono text-[11px] text-stone-500">
                        <span>{byId.get(m.agentId)?.label ?? "agent"}</span>
                        <span className="tabular-nums" title={new Date(m.createdAt).toLocaleString()}>{ago(m.createdAt)}</span>
                      </p>
                      {m.snippet ? <p className="mt-0.5 break-words text-stone-200">{m.snippet}</p> : null}
                      {m.url ? (
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 break-all font-mono text-[11px] text-violet-300 underline-offset-2 hover:underline">
                          {m.url.replace(/^https?:\/\//, "")} <ArrowUpRight className="size-3 shrink-0" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}

        {node.type === "connector" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{node.meta?.builtin ? "built-in" : (node.kind ?? "custom")}</Chip>
              {node.meta?.slug ? <span className="font-mono text-[12px] text-stone-500">{node.meta.slug}</span> : null}
            </div>
            <NodeList title="Used by" nodes={usedBy} render={(n) => <AgentLink key={n.id} node={n} />} empty="No agent uses this yet." />
            {!node.meta?.builtin ? (
              <Link href="/connections" className="inline-flex items-center gap-1 text-[13px] text-stone-300 underline underline-offset-2 hover:text-stone-100">
                Manage connections <ArrowUpRight className="size-3.5" />
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500">{label}</dt>
      <dd className={cn("mt-0.5 font-mono tabular-nums text-stone-100", small ? "text-[13px] leading-7" : "text-[22px] leading-7")}>{value}</dd>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-[3px] border border-white/10 bg-white/5 px-1.5 py-0.5 text-[13px] text-stone-300">{children}</span>;
}

function NodeList({ title, nodes, render, empty }: { title: string; nodes: GraphNodeDto[]; render: (n: GraphNodeDto) => React.ReactNode; empty?: string }) {
  if (nodes.length === 0 && !empty) return null;
  return (
    <section className="space-y-1.5">
      <Label>{title}</Label>
      {nodes.length === 0 ? <p className="text-stone-500">{empty}</p> : <div className="flex flex-wrap gap-1.5">{nodes.map(render)}</div>}
    </section>
  );
}
