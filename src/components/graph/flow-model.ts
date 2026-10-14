import type { GraphNodeDto, GraphResponse } from "./types";
import { edgeId } from "./types";
import { glyphKey } from "./glyphs";

export type FlowKind = "source" | "agent" | "dest";
export type FlowNode = { id: string; kind: FlowKind; label: string; sub: string; glyph: string; node: GraphNodeDto | null };
export type FlowEdgeKind = "in" | "out" | "chain" | "outbox";
export type FlowEdge = { id: string; from: string; to: string; kind: FlowEdgeKind; /** server edge id for chains (pulse matching) */ chainId?: string };

export type FlowModel = {
  sources: FlowNode[];
  agents: FlowNode[];
  dests: FlowNode[];
  edges: FlowEdge[];
};

const OUTBOX_ID = "dest:outbox";
const slackId = (channel: string) => `dest:slack:${channel}`;

/** Agents ordered so each chain's upstream sits directly above its downstream. */
function orderAgents(agents: GraphNodeDto[], chains: { from: string; to: string }[]): GraphNodeDto[] {
  const ids = new Set(agents.map((a) => a.id));
  const placed: GraphNodeDto[] = [];
  const done = new Set<string>();
  const place = (a: GraphNodeDto) => {
    if (done.has(a.id)) return;
    done.add(a.id);
    placed.push(a);
    for (const c of chains) {
      if (c.from !== a.id || !ids.has(c.to)) continue;
      const next = agents.find((x) => x.id === c.to);
      if (next) place(next);
    }
  };
  const downstream = new Set(chains.map((c) => c.to));
  for (const a of agents) if (!downstream.has(a.id)) place(a);
  for (const a of agents) place(a);
  return placed;
}

export function buildFlow(graph: GraphResponse): FlowModel {
  const agentsRaw = graph.nodes.filter((n) => n.type === "agent");
  const chains = graph.edges.filter((e) => e.type === "trigger").map((e) => ({ from: e.source, to: e.target, id: edgeId(e) }));
  const agents = orderAgents(agentsRaw, chains);
  const connectors = graph.nodes.filter((n) => n.type === "connector");

  // Slack is where agents post, not where they read: it becomes a destination, not a source.
  const slackConn = new Set(connectors.filter((c) => glyphKey(c.meta?.slug, c.label) === "slack").map((c) => c.id));
  const sources: FlowNode[] = connectors
    .filter((c) => !slackConn.has(c.id))
    .filter((c) => graph.edges.some((e) => e.type === "uses" && e.target === c.id))
    .map((c) => ({
      id: c.id,
      kind: "source" as const,
      label: c.label,
      sub: c.meta?.builtin ? "built in" : (c.kind ?? "connected app"),
      glyph: glyphKey(c.meta?.slug, c.label),
      node: c,
    }));

  const edges: FlowEdge[] = [];
  for (const e of graph.edges) {
    if (e.type === "uses" && sources.some((s) => s.id === e.target)) {
      edges.push({ id: `in:${e.target}>${e.source}`, from: e.target, to: e.source, kind: "in" });
    }
  }

  const destMap = new Map<string, FlowNode>();
  for (const a of agents) {
    const usesSlack = graph.edges.some((e) => e.type === "uses" && e.source === a.id && slackConn.has(e.target));
    const ch = (a.meta?.sendsTo ?? "").match(/#[\w-]+/)?.[0] ?? null;
    if (usesSlack || ch) {
      const label = ch ?? "Slack";
      const id = slackId(label);
      if (!destMap.has(id)) destMap.set(id, { id, kind: "dest", label, sub: "Slack channel", glyph: "slack", node: null });
      edges.push({ id: `out:${a.id}>${id}`, from: a.id, to: id, kind: "out" });
    }
  }
  const dests = [...destMap.values()];
  if (agents.length > 0) {
    dests.push({ id: OUTBOX_ID, kind: "dest", label: "Outbox", sub: "every message, kept for you", glyph: "outbox", node: null });
    for (const a of agents) edges.push({ id: `outbox:${a.id}`, from: a.id, to: OUTBOX_ID, kind: "outbox" });
  }
  for (const c of chains) edges.push({ id: `chain:${c.id}`, from: c.from, to: c.to, kind: "chain", chainId: c.id });

  const agentNodes: FlowNode[] = agents.map((a) => ({ id: a.id, kind: "agent", label: a.label, sub: a.meta?.does ?? "", glyph: "plug", node: a }));
  return { sources, agents: agentNodes, dests, edges };
}

/** Everything upstream and downstream of `id` along edge direction (its "whole path"). */
export function pathOf(model: FlowModel, id: string): Set<string> {
  const out = new Set([id]);
  const walk = (dir: "down" | "up") => {
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of model.edges) {
        const [a, b] = dir === "down" ? [e.from, e.to] : [e.to, e.from];
        if (a === cur && !out.has(b)) {
          out.add(b);
          stack.push(b);
        }
      }
    }
  };
  walk("down");
  walk("up");
  return out;
}
