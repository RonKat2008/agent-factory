"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StatusPill } from "@/components/status-pill";
import { DURATION, EASE, SPRING, STAGGER } from "@/components/motion/tokens";
import { cn } from "@/lib/utils";
import { SourceGlyph } from "./glyphs";
import { buildFlow, pathOf, type FlowEdge, type FlowModel, type FlowNode } from "./flow-model";
import type { GraphResponse } from "./types";

type Props = {
  graph: GraphResponse;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** chain edge id -> number of times it fired since the page opened */
  fires: Record<string, number>;
};

type Box = { l: number; t: number; w: number; h: number };
type CardState = "idle" | "lit" | "dim" | "selected";

const DAY_MS = 24 * 3600 * 1000;
const COLORS = { in: "#7dd3fc", out: "#6ee7b7", chain: "#a78bfa", outbox: "#a8a29e" } as const;
const QUIET_STATUSES = ["broken", "paused", "needs_human", "building", "testing", "ready"];

function ago(iso?: string | null): string | null {
  if (!iso) return null;
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Runs in the last 24h; drives how many particles flow and how fast. */
function activityOf(n: FlowNode | undefined): number {
  const node = n?.node;
  if (!node || node.type !== "agent") return 0;
  if (node.status && QUIET_STATUSES.includes(node.status)) return 0;
  const cutoff = Date.now() - DAY_MS;
  return (node.meta?.recent ?? []).filter((r) => Date.parse(r.at) > cutoff).length;
}

function Sparkline({ runs }: { runs: { status: string }[] }) {
  if (runs.length === 0) return null;
  return (
    <span className="flex h-4 items-end gap-[2px]" role="img" aria-label={`Last ${Math.min(20, runs.length)} runs`}>
      {runs.slice(-20).map((r, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-[1px]", r.status === "succeeded" ? "h-4 bg-emerald-400/80" : r.status === "failed" ? "h-2.5 bg-red-400" : "h-3 bg-stone-500")}
        />
      ))}
    </span>
  );
}

function FlowCard({
  node, state, onHover, onSelect, register, index, children, className,
}: {
  node: FlowNode;
  state: CardState;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  register: (id: string, el: HTMLElement | null) => void;
  index: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.normal, ease: EASE.out, delay: index * STAGGER.loose }}
      className="w-full"
    >
      <button
        type="button"
        ref={(el) => register(node.id, el)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(node.id)}
        onBlur={() => onHover(null)}
        onClick={() => onSelect(node.id)}
        aria-pressed={state === "selected"}
        className={cn(
          "relative block w-full rounded-[10px] border border-white/10 bg-[#17171a] text-left",
          "transition-[opacity,border-color,background-color,box-shadow] duration-200 hover:border-white/25",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70",
          state === "dim" && "opacity-35",
          state === "lit" && "border-violet-400/50 bg-[#1b1a22]",
          state === "selected" && "border-violet-400 bg-[#1b1a22] shadow-[0_0_0_1px_rgba(167,139,250,0.6),0_8px_32px_-8px_rgba(124,58,237,0.5)]",
          className,
        )}
      >
        {children}
      </button>
    </motion.div>
  );
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1 px-1 text-[12px] font-medium tracking-wide text-stone-400">{children}</p>;
}

function pathD(e: FlowEdge, a: Box, b: Box, ai: [number, number], bi: [number, number]): string {
  if (e.kind === "chain") {
    if (b.t >= a.t + a.h) {
      const x1 = a.l + 44, y1 = a.t + a.h, x2 = b.l + 44, y2 = b.t;
      const dy = (y2 - y1) * 0.5;
      return `M${x1} ${y1} C${x1} ${y1 + dy} ${x2} ${y2 - dy} ${x2} ${y2}`;
    }
    const x1 = a.l + a.w, y1 = a.t + a.h / 2, x2 = b.l + b.w, y2 = b.t + b.h / 2;
    const bulge = 64;
    return `M${x1} ${y1} C${x1 + bulge} ${y1} ${x2 + bulge} ${y2} ${x2} ${y2}`;
  }
  const x1 = a.l + a.w;
  const y1 = a.t + (a.h * (ai[0] + 1)) / (ai[1] + 1);
  const x2 = b.l;
  const y2 = b.t + (b.h * (bi[0] + 1)) / (bi[1] + 1);
  const dx = Math.max(40, (x2 - x1) * 0.5);
  return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
}

export function FlowView({ graph, selectedId, onSelect, fires }: Props) {
  const model: FlowModel = useMemo(() => buildFlow(graph), [graph]);
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [hover, setHover] = useState<string | null>(null);

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }, []);

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const origin = wrap.getBoundingClientRect();
    const next: Record<string, Box> = {};
    els.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      next[id] = { l: r.left - origin.left + wrap.scrollLeft, t: r.top - origin.top + wrap.scrollTop, w: r.width, h: r.height };
    });
    setBoxes((prev) => {
      const keys = Object.keys(next);
      const same =
        keys.length === Object.keys(prev).length &&
        keys.every((k) => {
          const p = prev[k], v = next[k];
          return p && Math.abs(p.l - v.l) < 0.5 && Math.abs(p.t - v.t) < 0.5 && Math.abs(p.w - v.w) < 0.5 && Math.abs(p.h - v.h) < 0.5;
        });
      return same ? prev : next;
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    els.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [measure, model]);

  const focusId = hover ?? selectedId;
  const lit = useMemo(() => (focusId ? pathOf(model, focusId) : null), [model, focusId]);
  const stateOf = (id: string): CardState => {
    if (id === selectedId) return "selected";
    if (!lit) return "idle";
    if (!lit.has(id)) return "dim";
    return id === focusId ? "idle" : "lit";
  };

  // Ports: edges spread over a card's side, ordered by the other end's height so they don't cross.
  const paths = useMemo(() => {
    const ports = new Map<string, [number, number]>();
    const assign = (key: "from" | "to") => {
      const other = key === "from" ? "to" : "from";
      const groups = new Map<string, FlowEdge[]>();
      for (const e of model.edges) {
        if (e.kind === "chain") continue;
        groups.set(e[key], [...(groups.get(e[key]) ?? []), e]);
      }
      groups.forEach((list) => {
        const sorted = [...list].sort((x, y) => (boxes[x[other]]?.t ?? 0) - (boxes[y[other]]?.t ?? 0));
        sorted.forEach((e, i) => ports.set(`${e.id}:${key}`, [i, sorted.length]));
      });
    };
    assign("from");
    assign("to");
    const out: { e: FlowEdge; d: string }[] = [];
    for (const e of model.edges) {
      const a = boxes[e.from], b = boxes[e.to];
      if (!a || !b) continue;
      out.push({ e, d: pathD(e, a, b, ports.get(`${e.id}:from`) ?? [0, 1], ports.get(`${e.id}:to`) ?? [0, 1]) });
    }
    return out;
  }, [model, boxes]);

  const byId = useMemo(() => new Map([...model.sources, ...model.agents, ...model.dests].map((n) => [n.id, n])), [model]);
  const labelsOf = (id: string, kind: "in" | "out") =>
    model.edges
      .filter((e) => e.kind === kind && (kind === "in" ? e.to === id : e.from === id))
      .map((e) => byId.get(kind === "in" ? e.from : e.to)?.label)
      .filter((x): x is string => !!x);
  const pick = (id: string) => onSelect(id === selectedId ? null : id);

  return (
    <div ref={wrapRef} className="@container relative isolate h-full overflow-y-auto overflow-x-hidden p-4 sm:p-7">
      <svg aria-hidden className="pointer-events-none absolute left-0 top-0 z-0 hidden h-full w-full overflow-visible @2xl:block">
        <defs>
          <filter id="flow-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.slow, delay: 0.5, ease: EASE.out }}>
          {paths.map(({ e, d }) => {
            const on = !lit || (lit.has(e.from) && lit.has(e.to));
            const color = COLORS[e.kind];
            const act = e.kind === "in" ? activityOf(byId.get(e.to)) : e.kind === "chain" ? 1 : activityOf(byId.get(e.from));
            const particles = reduced || e.kind === "outbox" ? 0 : e.kind === "chain" ? 1 : act === 0 ? 0 : Math.min(3, 1 + Math.floor(act / 4));
            const dur = e.kind === "chain" ? 3.6 : Math.max(2.4, 6 - act * 0.35);
            const fired = e.chainId ? (fires[e.chainId] ?? 0) : 0;
            return (
              <g key={e.id} style={{ opacity: on ? 1 : 0.08, transition: "opacity 200ms" }}>
                {e.kind === "chain" ? (
                  <>
                    <path d={d} fill="none" stroke={color} strokeWidth={9} strokeOpacity={0.35} filter="url(#flow-glow)" />
                    <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
                  </>
                ) : (
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={e.kind === "outbox" ? 1 : 1.5}
                    strokeOpacity={e.kind === "outbox" ? 0.18 : lit && on ? 0.7 : 0.3}
                    strokeDasharray={e.kind === "outbox" ? "2 5" : undefined}
                    strokeLinecap="round"
                  />
                )}
                {Array.from({ length: particles }).map((_, i) => (
                  <g key={i}>
                    <circle r={e.kind === "chain" ? 5 : 4} fill={color} opacity={0.25} />
                    <circle r={e.kind === "chain" ? 2.4 : 1.8} fill={e.kind === "chain" ? "#ede9fe" : color} />
                    <animateMotion dur={`${dur}s`} begin={`${-(dur * i) / particles}s`} repeatCount="indefinite" path={d} />
                  </g>
                ))}
                {fired > 0 && !reduced && (
                  <g key={`fire-${fired}`}>
                    <path d={d} fill="none" stroke="#ede9fe" strokeWidth={4} strokeLinecap="round" opacity={0}>
                      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.8;1" dur="1.6s" fill="freeze" />
                    </path>
                    <g opacity={0}>
                      <circle r={13} fill="#a78bfa" opacity={0.4} filter="url(#flow-glow)" />
                      <circle r={5} fill="#fff" />
                      <animateMotion dur="1.4s" fill="freeze" path={d} calcMode="spline" keyTimes="0;1" keySplines="0.65 0 0.35 1" />
                      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.9;1" dur="1.4s" fill="freeze" />
                    </g>
                  </g>
                )}
              </g>
            );
          })}
        </motion.g>
      </svg>

      <div className="relative z-10 grid gap-8 @2xl:min-h-full @2xl:grid-cols-[minmax(112px,150px)_minmax(0,1fr)_minmax(112px,150px)] @2xl:gap-x-10 @4xl:grid-cols-[minmax(170px,210px)_minmax(0,1fr)_minmax(170px,210px)] @4xl:gap-x-[clamp(56px,9vw,128px)]">
        <section aria-label="Where agents get their information" className="flex flex-col justify-center gap-3">
          <ColumnLabel>Where they look</ColumnLabel>
          {model.sources.length === 0 && <p className="px-1 text-[13px] text-stone-500">No outside sources yet.</p>}
          {model.sources.map((n, i) => (
            <FlowCard key={n.id} node={n} index={i} state={stateOf(n.id)} onHover={setHover} onSelect={pick} register={register} className="p-2.5">
              <span className="flex items-center gap-2.5">
                <SourceGlyph name={n.glyph} />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-stone-100">{n.label}</span>
                  <span className="block truncate text-[11.5px] text-stone-400">{n.sub}</span>
                </span>
              </span>
            </FlowCard>
          ))}
        </section>

        <section aria-label="Your agents" className="mx-auto flex w-full max-w-[420px] flex-col justify-center gap-10 @2xl:max-w-none">
          <ColumnLabel>Your agents</ColumnLabel>
          {model.agents.map((n, i) => {
            const meta = n.node?.meta;
            const sent = ago(meta?.lastSentAt);
            const chainFired = model.edges.filter((e) => e.kind === "chain" && e.to === n.id).reduce((sum, e) => sum + (fires[e.chainId ?? ""] ?? 0), 0);
            const srcs = labelsOf(n.id, "in");
            const dsts = labelsOf(n.id, "out");
            return (
              <div key={n.id} className="relative">
                <FlowCard node={n} index={i} state={stateOf(n.id)} onHover={setHover} onSelect={pick} register={register} className="p-4">
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[15px] font-semibold leading-snug text-stone-50">{n.label}</span>
                    {n.node?.status ? <StatusPill status={n.node.status} className="shrink-0" /> : null}
                  </span>
                  {meta?.does ? <span className="mt-1.5 line-clamp-2 block text-[13px] leading-relaxed text-stone-300">{meta.does}</span> : null}
                  <span className="mt-3 flex items-end justify-between gap-3 text-[11.5px] text-stone-400">
                    <span>{sent ? `Last sent ${sent}` : "Nothing sent yet"}</span>
                    <Sparkline runs={meta?.recent ?? []} />
                  </span>
                  {(srcs.length > 0 || dsts.length > 0) && (
                    <span className="mt-3 flex flex-wrap gap-x-1.5 border-t border-white/10 pt-2.5 text-[11.5px] text-stone-400 @2xl:hidden">
                      {srcs.length > 0 && <span>Reads {srcs.join(", ")}</span>}
                      {dsts.length > 0 && <span>{srcs.length > 0 ? "· " : ""}posts to {dsts.join(", ")}</span>}
                    </span>
                  )}
                </FlowCard>
                {chainFired > 0 && !reduced && (
                  <motion.span
                    key={chainFired}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[10px] border-2 border-violet-300"
                    initial={{ opacity: 0.9, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.06 }}
                    transition={{ ...SPRING.gentle, delay: 1.3 }}
                  />
                )}
              </div>
            );
          })}
        </section>

        <section aria-label="Where agents send results" className="flex flex-col justify-center gap-3">
          <ColumnLabel>Where they post</ColumnLabel>
          {model.dests.map((n, i) => (
            <FlowCard key={n.id} node={n} index={i} state={stateOf(n.id)} onHover={setHover} onSelect={() => {}} register={register} className="p-2.5">
              <span className="flex items-center gap-2.5">
                <SourceGlyph name={n.glyph} />
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[13.5px] font-medium text-stone-100">{n.label}</span>
                  <span className="block truncate text-[11.5px] text-stone-400">{n.sub}</span>
                </span>
              </span>
            </FlowCard>
          ))}
        </section>
      </div>
    </div>
  );
}
