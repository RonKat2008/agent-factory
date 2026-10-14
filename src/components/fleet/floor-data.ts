import type { Agent } from "@/lib/types";

export const HOUR_MS = 3_600_000;
export const WINDOW_H = 12;

type Point = { t: number; agentName: string; kind: string; status: string; costUsd: number };

export type FloorData = {
  hourly: { ok: number; failed: number; from: number }[];
  runsInWindow: number;
  costSeries: number[];
  avgCost: number | null;
  events: { t: number; agentName: string; type: "failed" | "repair" }[];
  repairCount: number;
};

const COST_WINDOW = 5;
const COST_POINTS = 30;

export function buildFloorData(agents: Agent[], now: number): FloorData {
  const pts: Point[] = agents
    .flatMap((a) =>
      (a.recent ?? []).map((r) => ({
        t: new Date(r.startedAt).getTime(),
        agentName: a.name,
        kind: r.kind,
        status: r.status,
        costUsd: r.costUsd,
      })),
    )
    .sort((x, y) => x.t - y.t);

  const start = now - WINDOW_H * HOUR_MS;
  const hourly = Array.from({ length: WINDOW_H }, (_, i) => ({ ok: 0, failed: 0, from: start + i * HOUR_MS }));
  for (const p of pts) {
    if (p.kind === "repair_test" || p.t < start || p.t > now) continue;
    const bin = hourly[Math.min(WINDOW_H - 1, Math.floor((p.t - start) / HOUR_MS))];
    if (p.status === "succeeded") bin.ok += 1;
    else if (p.status === "failed") bin.failed += 1;
  }

  const costRuns = pts.filter((p) => p.kind !== "repair_test" && p.status !== "running").slice(-COST_POINTS);
  const costSeries = costRuns.map((_, i) => {
    const w = costRuns.slice(Math.max(0, i - COST_WINDOW + 1), i + 1);
    return w.reduce((s, p) => s + p.costUsd, 0) / w.length;
  });
  const avgCost = costRuns.length ? costRuns.reduce((s, p) => s + p.costUsd, 0) / costRuns.length : null;

  const events = pts
    .filter((p) => p.t >= start && (p.kind === "repair_test" || p.status === "failed"))
    .map((p) => ({ t: p.t, agentName: p.agentName, type: p.kind === "repair_test" ? ("repair" as const) : ("failed" as const) }));

  return {
    hourly,
    runsInWindow: hourly.reduce((s, b) => s + b.ok + b.failed, 0),
    costSeries,
    avgCost,
    events,
    repairCount: events.filter((e) => e.type === "repair").length,
  };
}
