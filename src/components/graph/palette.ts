import type { AgentStatus } from "@/lib/types";

/** Categorical entity colors: dataviz reference palette slots 1,2,3,5,4 (violet is reserved for chains). */
export const KIND_COLORS: Record<string, string> = {
  company: "#2a78d6",
  product: "#eb6834",
  release: "#1baf7a",
  person: "#e87ba4",
  topic: "#eda100",
};
export const KIND_FALLBACK = "#a8a29e";
export const kindColor = (kind?: string): string => (kind && KIND_COLORS[kind]) || KIND_FALLBACK;

/** Same semantics as StatusPill. */
export const STATUS_COLORS: Record<AgentStatus, string> = {
  live: "#10b981",
  broken: "#ef4444",
  repairing: "#f59e0b",
  needs_human: "#dc2626",
  paused: "#a8a29e",
  building: "#0ea5e9",
  testing: "#0ea5e9",
  ready: "#0284c7",
};
export const WORKING_STATUSES = new Set<AgentStatus>(["repairing", "building", "testing"]);

export const INK = "#1c1917";
export const INK_SOFT = "#57534e";
export const SURFACE = "#FBFAF7";
export const PAGE = "#F6F4EF";
export const VIOLET = "#7c3aed";
export const STONE_EDGE = "#a8a29e";
