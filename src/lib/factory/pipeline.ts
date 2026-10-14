// Shared pieces of the build/edit/feedback pipelines: dry-run summaries and version activation.
import { dryRun, type ExecResult } from "@/lib/runtime/run-agent";
import { nextRunAt } from "@/lib/runtime/schedule";
import { addRunCost, getAgent, getRun, logEvent, setVersionStatus, updateAgent } from "@/lib/repo";
import type { AgentSpec } from "@/lib/spec";

const STEP_PREVIEW_CHARS = 600;
const TOTAL_PREVIEW_CHARS = 3_800;

/** JSON-serializable summary of a dry run (safe to return from a workflow step). */
export type DryOutcome = {
  runId: string;
  passed: boolean;
  testsPassed: number;
  testsTotal: number;
  failures: string[];
  stepSummaries: string;
  seconds: number;
  costUsd: number;
};

export function failureDetails(res: ExecResult): string[] {
  if (res.stepError) return [`step "${res.stepError.stepId}" (${res.stepError.block}) failed: ${res.stepError.error}`];
  return res.failedTests.map((t) => `${t.kind}: ${t.detail ?? "failed"}`);
}

async function summarizeSteps(runId: string, message: string): Promise<string> {
  const run = await getRun(runId);
  const parts = (run?.steps ?? []).map((s) => {
    const body = s.error ? `ERROR ${s.error}` : JSON.stringify(s.output ?? null);
    return `[${s.stepId}/${s.block} ${s.status}] ${body.slice(0, STEP_PREVIEW_CHARS)}`;
  });
  parts.push(`[final message] ${message.slice(0, STEP_PREVIEW_CHARS)}`);
  return parts.join("\n").slice(0, TOTAL_PREVIEW_CHARS);
}

/** Dry-runs `spec`, adds any pending AI cost to the run row, returns a compact outcome. */
export async function dryRunOutcome(agentId: string, spec: AgentSpec, pendingCostUsd = 0): Promise<DryOutcome> {
  const started = Date.now();
  const res = await dryRun(agentId, spec, "dry_run");
  if (pendingCostUsd > 0) await addRunCost(res.runId, pendingCostUsd);
  const testsTotal = res.stepError ? spec.tests.length : res.tests.length;
  const passed = res.status !== "failed";
  return {
    runId: res.runId,
    passed,
    testsPassed: res.stepError ? 0 : res.tests.length - res.failedTests.length,
    testsTotal,
    failures: passed ? [] : failureDetails(res),
    stepSummaries: passed ? "" : await summarizeSteps(res.runId, res.output.message),
    seconds: (Date.now() - started) / 1000,
    costUsd: res.costUsd + pendingCostUsd,
  };
}

/** Makes `version` the live version of the agent (schedule/approval taken from its spec). */
export async function activateVersion(agentId: string, version: number, spec: AgentSpec): Promise<void> {
  const agent = await getAgent(agentId);
  await setVersionStatus(agentId, version, "active");
  await updateAgent(agentId, {
    currentVersion: version,
    schedule: spec.schedule,
    requiresApproval: spec.requiresApproval,
    ...(agent?.status === "live" ? { nextRunAt: nextRunAt(spec.schedule) } : {}),
  });
}

export async function logEdited(agentId: string, version: number, changeSummary: string, o: DryOutcome): Promise<void> {
  await logEvent(agentId, "edited", `v${version} live: ${changeSummary} — ${o.testsPassed}/${o.testsTotal} tests passed`, {
    version,
    runId: o.runId,
  });
}

export function blockChain(spec: AgentSpec): string {
  return spec.steps.map((s) => s.block).join(" → ");
}
