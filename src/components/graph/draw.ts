import { DURATION } from "@/components/motion/tokens";
import type { Sim, SimNode } from "./sim";
import { INK, INK_SOFT, kindColor, PAGE, STATUS_COLORS, STONE_EDGE, SURFACE, VIOLET, WORKING_STATUSES } from "./palette";

export type View = { x: number; y: number; k: number };
export type ActivePulse = { edgeId: string; start: number };
export type Flash = { nodeId: string; start: number };

export type DrawState = {
  width: number;
  height: number;
  dpr: number;
  view: View;
  hoverId: string | null;
  selectedId: string | null;
  neighbors: Set<string> | null;
  pulses: ActivePulse[];
  flashes: Flash[];
  now: number;
  reduced: boolean;
  fonts: { sans: string; mono: string };
};

/** A chain firing: the dot travels the edge, then the downstream node gets one expanding ring. */
export const PULSE_MS = Math.round(DURATION.crawl * 1000 * 1.6);
export const FLASH_MS = Math.round(DURATION.slow * 1000 * 2.2);

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function squarePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const s = r * 1.7;
  ctx.beginPath();
  ctx.roundRect(x - s / 2, y - s / 2, s, s, 4);
}

function haloText(ctx: CanvasRenderingContext2D, text: string, y: number): void {
  ctx.lineWidth = 4;
  ctx.strokeStyle = PAGE;
  ctx.lineJoin = "round";
  ctx.strokeText(text, 0, y);
  ctx.fillText(text, 0, y);
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Entities that always get a label: the most-mentioned ones. Others label on hover or zoom. */
const TOP_LABELS = 14;

function showEntityLabel(n: SimNode, s: DrawState, top: Set<string>): boolean {
  if (n.id === s.hoverId || n.id === s.selectedId) return true;
  if (s.neighbors?.has(n.id)) return true;
  if (s.view.k > 1.6) return true;
  return top.has(n.id);
}

export function draw(ctx: CanvasRenderingContext2D, sim: Sim, s: DrawState): void {
  const { width, height, dpr, view } = s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // dot grid in screen space
  const step = Math.max(14, 28 * view.k);
  ctx.fillStyle = "rgba(168,162,158,0.10)";
  const ox = ((view.x % step) + step) % step;
  const oy = ((view.y % step) + step) % step;
  for (let gx = ox; gx < width; gx += step) for (let gy = oy; gy < height; gy += step) ctx.fillRect(gx, gy, 1.2, 1.2);

  ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
  const dimming = s.selectedId !== null;
  const lit = (id: string) => !dimming || id === s.selectedId || !!s.neighbors?.has(id);
  const byEdge = new Map(sim.edges.map((e) => [e.id, e]));

  // edges: mention, uses, then trigger on top
  const order = { mention: 0, uses: 1, trigger: 2 } as const;
  for (const e of [...sim.edges].sort((a, b) => order[a.type] - order[b.type])) {
    ctx.globalAlpha = lit(e.s.id) && lit(e.t.id) ? 1 : 0.12;
    const dx = e.t.x - e.s.x;
    const dy = e.t.y - e.s.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const gap = e.type === "trigger" ? 4 : 1;
    const sx = e.s.x + ux * e.s.r;
    const sy = e.s.y + uy * e.s.r;
    const tx = e.t.x - ux * (e.t.r + gap);
    const ty = e.t.y - uy * (e.t.r + gap);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    if (e.type === "trigger") {
      ctx.setLineDash([]);
      const firing = s.pulses.find((p) => p.edgeId === e.id && s.now >= p.start && s.now - p.start < PULSE_MS);
      if (firing) {
        // the whole edge glows while the dot is travelling, fading as it arrives
        const k = 1 - (s.now - firing.start) / PULSE_MS;
        ctx.strokeStyle = `rgba(124,58,237,${0.28 * k})`;
        ctx.lineWidth = 3 + 9 * k;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.lineCap = "butt";
      }
      ctx.strokeStyle = VIOLET;
      ctx.lineWidth = 3;
      ctx.stroke();
      const ah = 11;
      ctx.beginPath();
      ctx.moveTo(tx + ux * 2, ty + uy * 2);
      ctx.lineTo(tx - ux * ah - uy * 5.5, ty - uy * ah + ux * 5.5);
      ctx.lineTo(tx - ux * ah + uy * 5.5, ty - uy * ah - ux * 5.5);
      ctx.closePath();
      ctx.fillStyle = VIOLET;
      ctx.fill();
    } else if (e.type === "uses") {
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "#78716c";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = STONE_EDGE;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // pulses: glowing dot travelling source -> target
  for (const p of s.pulses) {
    const e = byEdge.get(p.edgeId);
    if (!e) continue;
    const t = Math.min(1, (s.now - p.start) / PULSE_MS);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const px = e.s.x + (e.t.x - e.s.x) * eased;
    const py = e.s.y + (e.t.y - e.s.y) * eased;
    const g = ctx.createRadialGradient(px, py, 0, px, py, 22);
    g.addColorStop(0, "rgba(124,58,237,0.75)");
    g.addColorStop(0.35, "rgba(124,58,237,0.28)");
    g.addColorStop(1, "rgba(124,58,237,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ede9fe";
    ctx.strokeStyle = VIOLET;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // nodes: entities, connectors, agents
  const rank = { entity: 0, connector: 1, agent: 2 } as const;
  const nodes = [...sim.nodes].sort((a, b) => rank[a.type] - rank[b.type]);
  for (const n of nodes) {
    ctx.globalAlpha = lit(n.id) ? 1 : 0.22;
    const hot = n.id === s.hoverId || n.id === s.selectedId;
    if (n.type === "entity") {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + (hot ? 1.5 : 0), 0, Math.PI * 2);
      ctx.fillStyle = kindColor(n.kind);
      ctx.fill();
      ctx.lineWidth = hot ? 2.5 : 1.5;
      ctx.strokeStyle = hot ? INK : SURFACE;
      ctx.stroke();
    } else if (n.type === "connector") {
      if (n.meta?.builtin) hexPath(ctx, n.x, n.y, n.r + 1);
      else squarePath(ctx, n.x, n.y, n.r);
      ctx.fillStyle = "#e7e5e4";
      ctx.fill();
      ctx.lineWidth = hot ? 2.5 : 1.5;
      ctx.strokeStyle = hot ? INK : "#78716c";
      ctx.stroke();
      ctx.fillStyle = INK_SOFT;
      ctx.font = `600 9px ${s.fonts.mono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label.slice(0, 2).toUpperCase(), n.x, n.y + 0.5);
    } else {
      const color = n.status ? STATUS_COLORS[n.status] : STONE_EDGE;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = SURFACE;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = color;
      ctx.stroke();
      if (hot) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 5, 0, Math.PI * 2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      if (n.status && WORKING_STATUSES.has(n.status) && !s.reduced) {
        const a = (s.now / 700) % (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 5, a, a + 1.4);
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();
      }
      ctx.fillStyle = INK;
      ctx.font = `600 15px ${s.fonts.sans}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label.trim().charAt(0).toUpperCase(), n.x, n.y + 0.5);
    }
  }
  ctx.globalAlpha = 1;

  // arrival flashes
  for (const f of s.flashes) {
    const n = sim.byId.get(f.nodeId);
    if (!n) continue;
    const t = Math.min(1, (s.now - f.start) / FLASH_MS);
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r + 4 + (s.reduced ? 6 : t * 18), 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(124,58,237,${(1 - t) * 0.85})`;
    ctx.stroke();
  }

  // labels (constant screen size)
  const top = new Set(
    nodes
      .filter((n) => n.type === "entity")
      .sort((a, b) => b.weight - a.weight)
      .slice(0, TOP_LABELS)
      .map((n) => n.id),
  );
  const inv = 1 / view.k;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const n of nodes) {
    if (n.type === "entity" && !showEntityLabel(n, s, top)) continue;
    ctx.globalAlpha = lit(n.id) ? 1 : 0.22;
    ctx.save();
    ctx.translate(n.x, n.y + n.r + (n.type === "agent" ? 8 : 4));
    ctx.scale(inv, inv);
    if (n.type === "agent") {
      ctx.font = `600 13px ${s.fonts.sans}`;
      ctx.fillStyle = INK;
      haloText(ctx, clip(n.label, 26), 0);
    } else if (n.type === "connector") {
      ctx.font = `500 12px ${s.fonts.sans}`;
      ctx.fillStyle = INK_SOFT;
      haloText(ctx, clip(n.label, 22), 0);
    } else {
      ctx.font = `500 11px ${s.fonts.sans}`;
      ctx.fillStyle = INK;
      haloText(ctx, clip(n.label, 28), 0);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
