// UI-facing API types. Owned by the backend lane — UI imports, never edits.
// Every /api response shape in docs/API.md uses these.
import type { AgentSpec, AgentTest, PlanCard, RunOutput } from "./spec";

export type AgentStatus =
  | "building"
  | "testing"
  | "ready" // tests passed, waiting for Go live
  | "live"
  | "paused"
  | "broken"
  | "repairing"
  | "needs_human";

export type Agent = {
  id: string;
  name: string;
  request: string;
  status: AgentStatus;
  currentVersion: number | null;
  schedule: string;
  scheduleHuman: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  requiresApproval: boolean;
  health: number; // 0-100, pass rate over the last 20 runs
  runs: number;
  successRate: number; // 0-1
  costUsd: number;
  usefulRate: number | null; // 0-1, null without feedback
  repairs: number;
  plan: PlanCard | null;
  /** Last 20 non-dry runs, oldest to newest (listAgents only). */
  recent?: { status: RunStatus; kind: RunKind; startedAt: string; costUsd: number; ms: number | null }[];
  /** Latest successfully posted message (listAgents only). */
  lastOutput?: { message: string; at: string } | null;
  /** Trigger chain links to other agents. */
  chains?: { triggers: { id: string; name: string }[]; triggeredBy: { id: string; name: string } | null };
};

export type EventType =
  | "built"
  | "dry_run"
  | "test_failed"
  | "self_fixed"
  | "tests_passed"
  | "went_live"
  | "run_succeeded"
  | "run_failed"
  | "broke"
  | "repairing"
  | "repaired"
  | "needs_human"
  | "edited"
  | "proposed"
  | "paused"
  | "resumed"
  | "approval_needed"
  | "feedback"
  | "triggered" // a chain fired: "Triggered by <upstream agent>"
  | "chain_skipped"; // a chain did not fire (loop guard, depth cap, downstream paused/broken)

export type FeedEvent = {
  id: string;
  agentId: string | null;
  agentName: string | null;
  type: EventType;
  message: string;
  data: Record<string, unknown> | null;
  createdAt: string;
};

export type Stats = {
  agentsLive: number;
  runsToday: number;
  autoRepairs: number;
  totalCostUsd: number;
};

export type StepRun = {
  idx: number;
  stepId: string;
  block: string;
  status: "ok" | "error" | "skipped";
  ms: number | null;
  input: unknown;
  output: unknown;
  error: string | null;
};

export type TestResult = {
  testIndex: number;
  kind: string;
  passed: boolean;
  detail: string | null;
};

export type RunKind = "scheduled" | "manual" | "triggered" | "dry_run" | "repair_test";
export type RunStatus = "running" | "succeeded" | "failed" | "awaiting_approval" | "rejected";

export type Run = {
  id: string;
  agentId: string;
  version: number;
  kind: RunKind;
  status: RunStatus;
  output: RunOutput | null;
  error: string | null;
  costUsd: number;
  startedAt: string;
  finishedAt: string | null;
  steps?: StepRun[];
  tests?: TestResult[];
  feedback?: "useful" | "not_useful" | null;
};

export type AgentVersion = {
  version: number;
  parentVersion: number | null;
  spec: AgentSpec;
  reason: string;
  createdBy: "user" | "factory";
  status: "active" | "proposed" | "rejected";
  createdAt: string;
};

export type OutboxMessage = {
  id: string;
  agentId: string | null;
  runId: string | null;
  body: string;
  sentOk: boolean;
  createdAt: string;
};

export type AgentDetail = {
  agent: Agent;
  versions: AgentVersion[]; // newest first
  runs: Run[]; // newest first, last 30, with steps + tests
};

export type { AgentSpec, AgentTest, PlanCard, RunOutput };
