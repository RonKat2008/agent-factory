import type { AgentStatus } from "@/lib/types";

export type GraphNodeType = "agent" | "entity" | "connector";
export type GraphEdgeType = "trigger" | "mention" | "uses";

export type GraphNodeMeta = {
  version?: number | null;
  lastRunAt?: string | null;
  lastOutput?: string | null;
  health?: number;
  schedule?: string;
  lastSeen?: string;
  slug?: string;
  builtin?: boolean;
};

export type GraphNodeDto = {
  id: string;
  type: GraphNodeType;
  label: string;
  status?: AgentStatus;
  kind?: string;
  weight: number;
  meta?: GraphNodeMeta;
};

export type GraphEdgeDto = { source: string; target: string; type: GraphEdgeType; weight: number };
export type GraphPulseDto = { edgeId: string; at: string };

export type GraphResponse = { nodes: GraphNodeDto[]; edges: GraphEdgeDto[]; pulses: GraphPulseDto[] };

/** Edge ids are deterministic so pulses can reference them. */
export const edgeId = (e: { source: string; target: string; type: GraphEdgeType }) => `${e.type}:${e.source}>${e.target}`;
