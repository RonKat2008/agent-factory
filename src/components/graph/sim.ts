import { edgeId, type GraphEdgeDto, type GraphNodeDto, type GraphResponse } from "./types";

export type SimNode = GraphNodeDto & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** pinned while dragging */
  fx: number | null;
  fy: number | null;
};
export type SimEdge = GraphEdgeDto & { id: string; s: SimNode; t: SimNode };

export type Sim = {
  nodes: SimNode[];
  edges: SimEdge[];
  byId: Map<string, SimNode>;
  alpha: number;
  /** iterations left before the sim idles regardless of alpha */
  budget: number;
};

const ALPHA_MIN = 0.002;
const ALPHA_DECAY = 0.018;
const MAX_ITERATIONS = 420;
const REST: Record<GraphEdgeDto["type"], number> = { trigger: 200, uses: 190, mention: 90 };
const SPRING: Record<GraphEdgeDto["type"], number> = { trigger: 0.05, uses: 0.02, mention: 0.045 };

export function radiusOf(n: GraphNodeDto): number {
  if (n.type === "agent") return 24;
  if (n.type === "connector") return 15;
  return Math.min(14, 4 + Math.sqrt(n.weight) * 2.2);
}

export function createSim(): Sim {
  return { nodes: [], edges: [], byId: new Map(), alpha: 0, budget: 0 };
}

/** Topology signature: sim reheats only when this changes. */
export function signature(g: GraphResponse): string {
  return `${g.nodes.map((n) => n.id).sort().join(",")}|${g.edges.map(edgeId).sort().join(",")}`;
}

/** Merge fresh API data into the sim, keeping positions of nodes that already exist. */
export function mergeGraph(sim: Sim, g: GraphResponse): void {
  const prev = sim.byId;
  const byId = new Map<string, SimNode>();
  const neighbor = new Map<string, string>();
  for (const e of g.edges) {
    if (!neighbor.has(e.target)) neighbor.set(e.target, e.source);
    if (!neighbor.has(e.source)) neighbor.set(e.source, e.target);
  }
  const agents = g.nodes.filter((n) => n.type === "agent");
  const nodes: SimNode[] = g.nodes.map((n) => {
    const old = prev.get(n.id);
    const r = radiusOf(n);
    if (old) {
      Object.assign(old, n, { r });
      byId.set(n.id, old);
      return old;
    }
    const anchor = byId.get(neighbor.get(n.id) ?? "") ?? prev.get(neighbor.get(n.id) ?? "");
    let x: number;
    let y: number;
    if (anchor) {
      const a = Math.random() * Math.PI * 2;
      x = anchor.x + Math.cos(a) * 60;
      y = anchor.y + Math.sin(a) * 60;
    } else if (n.type === "agent") {
      const i = agents.findIndex((a) => a.id === n.id);
      const a = (i / Math.max(1, agents.length)) * Math.PI * 2;
      x = Math.cos(a) * 180;
      y = Math.sin(a) * 180;
    } else {
      x = (Math.random() - 0.5) * 300;
      y = (Math.random() - 0.5) * 300;
    }
    const node: SimNode = { ...n, x, y, vx: 0, vy: 0, r, fx: null, fy: null };
    byId.set(n.id, node);
    return node;
  });
  const edges: SimEdge[] = [];
  for (const e of g.edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (s && t && s !== t) edges.push({ ...e, id: edgeId(e), s, t });
  }
  sim.nodes = nodes;
  sim.edges = edges;
  sim.byId = byId;
}

export function reheat(sim: Sim, alpha = 0.7): void {
  sim.alpha = Math.max(sim.alpha, alpha);
  sim.budget = MAX_ITERATIONS;
}

export const isActive = (sim: Sim): boolean => sim.alpha > ALPHA_MIN && sim.budget > 0;

export function tick(sim: Sim): void {
  if (!isActive(sim)) return;
  const { nodes, edges, alpha } = sim;
  const n = nodes.length;

  // pairwise repulsion + collision
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        d2 = dx * dx + dy * dy + 0.01;
      }
      const d = Math.sqrt(d2);
      const big = a.type === "agent" || b.type === "agent" ? 1 : 0.55;
      const force = ((7500 * big) / d2) * alpha;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
      const min = a.r + b.r + 8;
      if (d < min) {
        const push = ((min - d) / d) * 0.5;
        a.vx -= dx * push * 0.2;
        a.vy -= dy * push * 0.2;
        b.vx += dx * push * 0.2;
        b.vy += dy * push * 0.2;
      }
    }
  }

  // edge springs
  for (const e of edges) {
    const dx = e.t.x - e.s.x;
    const dy = e.t.y - e.s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const k = SPRING[e.type] * alpha;
    const f = (d - REST[e.type]) * k;
    const fx = (dx / d) * f;
    const fy = (dy / d) * f;
    e.s.vx += fx;
    e.s.vy += fy;
    e.t.vx -= fx;
    e.t.vy -= fy;
  }

  // centering + integrate
  for (const nd of nodes) {
    nd.vx -= nd.x * 0.006 * alpha;
    nd.vy -= nd.y * 0.006 * alpha;
    if (nd.fx != null && nd.fy != null) {
      nd.x = nd.fx;
      nd.y = nd.fy;
      nd.vx = 0;
      nd.vy = 0;
      continue;
    }
    nd.vx *= 0.82;
    nd.vy *= 0.82;
    nd.x += nd.vx;
    nd.y += nd.vy;
  }

  sim.alpha *= 1 - ALPHA_DECAY;
  sim.budget -= 1;
}

export function settle(sim: Sim): void {
  while (isActive(sim)) tick(sim);
}

export function bounds(sim: Sim): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (sim.nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of sim.nodes) {
    minX = Math.min(minX, n.x - n.r);
    minY = Math.min(minY, n.y - n.r - 18);
    maxX = Math.max(maxX, n.x + n.r);
    maxY = Math.max(maxY, n.y + n.r + 22);
  }
  return { minX, minY, maxX, maxY };
}
