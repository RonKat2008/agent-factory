// Core agent runtime: executes a spec block by block, persists every step, runs tests, finalizes the run.
// Used directly (dryRun / executeSpec) and piece-by-piece from the durable workflow (src/workflows/run-agent.ts).
import { runBlock, type BlockContext } from "@/lib/blocks";
import {
  createRun,
  finishRun,
  getActiveVersion,
  getAgent,
  insertStepRun,
  insertTestResults,
  logEvent,
  memoryGet,
  memorySet,
  updateAgent,
} from "@/lib/repo";
import type { AgentSpec, RunOutput, Step } from "@/lib/spec";
import type { RunKind, RunStatus } from "@/lib/types";
import { deliver } from "./deliver";
import { deriveRunOutput, isBulletLine, type StepResultLite } from "./output";
import { triggerRepair } from "./repair-hook";
import { nextRunAt } from "./schedule";
import { resolveParams } from "./template";
import { runTests, type TestResult } from "./tests";

export type TestResultRow = TestResult;
export type StepError = { stepId: string; block: string; error: string; input: unknown };
export type ExecResult = {
  runId: string;
  status: RunStatus;
  output: RunOutput;
  tests: TestResultRow[];
  failedTests: TestResultRow[];
  stepError: StepError | null;
  costUsd: number;
};
/** JSON-serializable result of one block execution (also the workflow step return value). */
export type StepOutcome = {
  ok: boolean;
  output?: unknown;
  resolvedParams?: unknown;
  error?: string;
  costUsd: number;
  /** send_slack ran in dry mode in a live run; this message is delivered only if tests pass (and no approval hold). */
  pendingSend?: string;
};

export type ExecInput = {
  agentId: string;
  version: number;
  spec: AgentSpec;
  kind: RunKind;
  runId: string;
  requiresApproval: boolean;
};

export const isDryKind = (kind: RunKind) => kind === "dry_run" || kind === "repair_test";

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function makeContext(agentId: string, runId: string, dryRun: boolean): BlockContext {
  return {
    agentId,
    runId,
    dryRun,
    appUrl: appUrl(),
    memoryGet: (key) => memoryGet(agentId, key),
    memorySet: (key, value) => memorySet(agentId, key, value),
    deliver: (message) => deliver({ agentId, runId, message }),
  };
}

const TEMPLATE_REF_RE = /\{\{\s*steps\.[^}\s]+\s*\}\}/g;

/** True when the text has templates and every one resolves to empty content. */
function templatesAllEmpty(text: string, outputs: Record<string, unknown>): boolean {
  const refs = text.match(TEMPLATE_REF_RE) ?? [];
  if (refs.length === 0) return false;
  return refs.every((ref) => {
    const v = resolveParams(ref, outputs).value;
    if (v == null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    return false;
  });
}

/** Runs one step (resolve templates, run block, persist step_run). Never throws on block errors. */
export async function executeStepAt(a: {
  agentId: string;
  runId: string;
  idx: number;
  step: Step;
  outputs: Record<string, unknown>; // step id -> output of earlier ok steps
  dryRun: boolean;
  holdSend: boolean; // live run: run send_slack in dry mode; finalizeExec delivers after tests pass
}): Promise<StepOutcome> {
  const { step } = a;
  const started = Date.now();
  const r0 = resolveParams(step.params, a.outputs);
  const { missing } = r0;
  let resolved = r0.value;
  // "*Header*\n{{steps.x.markdown}}" with an empty x is still empty content: let skipIfEmpty skip it.
  if (step.block === "send_slack" && step.params.skipIfEmpty && missing.length === 0 && templatesAllEmpty(step.params.message, a.outputs)) {
    resolved = { ...(resolved as Record<string, unknown>), message: "" };
  }
  let outcome: StepOutcome;
  if (missing.length > 0) {
    outcome = { ok: false, resolvedParams: resolved, error: `unresolved reference ${missing.map((m) => `{{${m}}}`).join(", ")}`, costUsd: 0 };
  } else {
    const holding = a.holdSend && step.block === "send_slack";
    const ctx = makeContext(a.agentId, a.runId, a.dryRun || holding);
    const r = await runBlock(step, resolved, ctx);
    const costUsd = r.costUsd ?? 0;
    outcome = r.ok
      ? { ok: true, output: r.output, resolvedParams: resolved, costUsd }
      : { ok: false, resolvedParams: resolved, error: r.error, costUsd };
    const wouldSend = r.ok ? (r.output as { wouldSend?: unknown }).wouldSend : undefined;
    if (holding && typeof wouldSend === "string" && wouldSend.trim()) outcome.pendingSend = wouldSend;
  }
  await insertStepRun({
    runId: a.runId,
    idx: a.idx,
    stepId: step.id,
    block: step.block,
    status: outcome.ok ? "ok" : "error",
    input: resolved,
    output: outcome.output ?? null,
    error: outcome.error ?? null,
    ms: Date.now() - started,
  });
  return outcome;
}

/**
 * Primes diff_with_memory state: runs the steps up to the last diff step (no run row, nothing sent),
 * so the agent's first real run only reports what changed after this moment.
 */
export async function baselineMemory(agentId: string, spec: AgentSpec): Promise<{ ok: boolean; error?: string }> {
  const lastDiff = spec.steps.map((s) => s.block).lastIndexOf("diff_with_memory");
  if (lastDiff < 0) return { ok: true };
  const prefix = spec.steps.slice(0, lastDiff + 1);
  if (prefix.some((s) => s.block === "send_slack" || s.block === "github_issues" || s.block === "require_approval")) {
    return { ok: false, error: "a side-effecting step comes before the diff step" };
  }
  const ctx = makeContext(agentId, "00000000-0000-0000-0000-000000000000", false);
  const outputs: Record<string, unknown> = {};
  for (const step of prefix) {
    const { value, missing } = resolveParams(step.params, outputs);
    if (missing.length > 0) return { ok: false, error: `unresolved reference in ${step.id}` };
    const r = await runBlock(step, value, ctx);
    if (!r.ok) return { ok: false, error: `${step.id}: ${r.error}` };
    outputs[step.id] = r.output;
  }
  return { ok: true };
}

/** Records `skipped` rows for steps that never ran after an error. */
export async function skipSteps(runId: string, steps: Step[], fromIdx: number): Promise<void> {
  for (let i = fromIdx; i < steps.length; i++) {
    await insertStepRun({ runId, idx: i, stepId: steps[i].id, block: steps[i].block, status: "skipped" });
  }
}

function describeFailure(stepError: StepError | null, failed: TestResultRow[]): string | null {
  if (stepError) return `Step "${stepError.stepId}" (${stepError.block}) failed: ${stepError.error}`;
  if (failed.length > 0) return `Tests failed: ${failed.map((t) => `${t.kind}: ${t.detail}`).join("; ")}`;
  return null;
}

export const JUDGE_KIND = "llm_judge";

/** True when the only failures are llm_judge tests (no step error, no deterministic test failure). */
export function isJudgeOnlyFailure(r: Pick<ExecResult, "stepError" | "failedTests">): boolean {
  return !r.stepError && r.failedTests.length > 0 && r.failedTests.every((t) => t.kind === JUDGE_KIND);
}

/**
 * Derives output, runs (or skips) tests, persists results and finishes the run row.
 * Test-gated delivery: a pending send (live runs) is delivered ONLY when every test passes and no approval hold applies.
 */
export async function finalizeExec(a: {
  agentId: string;
  runId: string;
  spec: AgentSpec;
  outcomes: Record<string, StepOutcome>;
  stepError: StepError | null;
  requiresApproval: boolean;
}): Promise<ExecResult> {
  const lite: Record<string, StepResultLite> = a.outcomes;
  const pending = Object.values(a.outcomes).find((o) => o.pendingSend)?.pendingSend;
  // Tests judge what WOULD be posted, so no_post_if_unchanged still catches a would-be post.
  const derived = deriveRunOutput(a.spec, lite);
  const output: RunOutput = pending ? { ...derived, posted: true } : derived;
  let costUsd = Object.values(a.outcomes).reduce((s, o) => s + (o.costUsd ?? 0), 0);

  let tests: TestResultRow[];
  if (a.stepError) {
    tests = [{ testIndex: 0, kind: "step_succeeds", passed: false, detail: `Tests skipped: ${describeFailure(a.stepError, [])}`, costUsd: 0 }];
  } else {
    tests = await runTests(a.spec, output, lite);
    costUsd += tests.reduce((s, t) => s + t.costUsd, 0);
  }
  await insertTestResults(a.runId, tests);
  const failedTests = tests.filter((t) => !t.passed);

  let status: RunStatus;
  let posted = false;
  let error: string | null = null;
  if (a.stepError || failedTests.length > 0) {
    status = "failed";
    error = isJudgeOnlyFailure({ stepError: a.stepError, failedTests })
      ? `held: ${failedTests.map((t) => t.detail).join("; ")}`
      : describeFailure(a.stepError, failedTests);
  } else if (pending && a.requiresApproval) {
    status = "awaiting_approval";
  } else {
    status = "succeeded";
    if (pending) posted = (await deliver({ agentId: a.agentId, runId: a.runId, message: pending })).sent;
  }
  const finalOutput: RunOutput = { ...output, posted };
  await finishRun(a.runId, { status, output: finalOutput, error, costUsd });
  return { runId: a.runId, status, output: finalOutput, tests, failedTests, stepError: a.stepError, costUsd };
}

/** Executes a spec in one process (no durability). The run row must already exist. */
export async function executeSpec(input: ExecInput): Promise<ExecResult> {
  const { agentId, spec, runId } = input;
  const dryRun = isDryKind(input.kind);
  const holdSend = !dryRun; // every live send is deferred until tests pass
  const outputs: Record<string, unknown> = {};
  const outcomes: Record<string, StepOutcome> = {};
  let stepError: StepError | null = null;
  try {
    for (let i = 0; i < spec.steps.length; i++) {
      const step = spec.steps[i];
      const o = await executeStepAt({ agentId, runId, idx: i, step, outputs, dryRun, holdSend });
      outcomes[step.id] = o;
      if (!o.ok) {
        stepError = { stepId: step.id, block: step.block, error: o.error ?? "unknown error", input: o.resolvedParams ?? null };
        await skipSteps(runId, spec.steps, i + 1);
        break;
      }
      outputs[step.id] = o.output;
    }
    return await finalizeExec({ agentId, runId, spec, outcomes, stepError, requiresApproval: input.requiresApproval && !dryRun });
  } catch (e) {
    return failRun(runId, (e as Error).message);
  }
}

/** Marks a run failed after an unexpected (infrastructure) error. */
export async function failRun(runId: string, message: string): Promise<ExecResult> {
  const output: RunOutput = { message: "", citations: [], posted: false, changed: null };
  const error = `Runtime error: ${message}`;
  try {
    await finishRun(runId, { status: "failed", output, error });
  } catch (e) {
    console.error("[runtime] failRun could not finish run", runId, e);
  }
  return {
    runId,
    status: "failed",
    output,
    tests: [],
    failedTests: [],
    stepError: { stepId: "runtime", block: "runtime", error, input: null },
    costUsd: 0,
  };
}

/** Dry-runs a spec that is not (necessarily) active. Creates the run row. Nothing is delivered or remembered. */
export async function dryRun(agentId: string, spec: AgentSpec, kind: "dry_run" | "repair_test"): Promise<ExecResult> {
  const agent = await getAgent(agentId);
  const version = agent?.currentVersion ?? 0;
  const runId = await createRun({ agentId, version, kind });
  return executeSpec({ agentId, version, spec, kind, runId, requiresApproval: false });
}

export type PreparedRun = { runId: string; version: number; spec: AgentSpec; requiresApproval: boolean };

/** Loads the active version and creates the run row (so callers can return runId immediately). */
export async function prepareRun(agentId: string, kind: "scheduled" | "manual"): Promise<PreparedRun | null> {
  const [agent, active] = await Promise.all([getAgent(agentId), getActiveVersion(agentId)]);
  if (!agent || !active) return null;
  const runId = await createRun({ agentId, version: active.version, kind });
  const requiresApproval = agent.requiresApproval || active.spec.steps.some((s) => s.block === "require_approval");
  return { runId, version: active.version, spec: active.spec, requiresApproval };
}

/** Loads run context for an existing run row. */
export async function loadRun(agentId: string): Promise<Omit<PreparedRun, "runId"> | null> {
  const [agent, active] = await Promise.all([getAgent(agentId), getActiveVersion(agentId)]);
  if (!agent || !active) return null;
  const requiresApproval = agent.requiresApproval || active.spec.steps.some((s) => s.block === "require_approval");
  return { version: active.version, spec: active.spec, requiresApproval };
}

/** Agent-level consequences of a live (scheduled/manual) run: events, next_run_at, broken + repair. */
export async function afterLiveRun(agentId: string, result: ExecResult): Promise<void> {
  const agent = await getAgent(agentId);
  if (!agent) return;
  if (result.status === "failed" && isJudgeOnlyFailure(result)) {
    const detail = result.failedTests.map((t) => t.detail).join("; ");
    await logEvent(agentId, "run_failed", `Held the post — quality check failed: ${detail}`, { runId: result.runId, held: true });
    if (agent.status === "live") await updateAgent(agentId, { nextRunAt: nextRunAt(agent.schedule) });
    return;
  }
  if (result.status === "failed") {
    const why = describeFailure(result.stepError, result.failedTests) ?? "Run failed";
    await updateAgent(agentId, { status: "broken" });
    await logEvent(agentId, "broke", why, {
      runId: result.runId,
      stepError: result.stepError,
      failedTests: result.failedTests.map((t) => ({ kind: t.kind, detail: t.detail })),
    });
    await triggerRepair(agentId, result.runId);
    return;
  }
  const bullets = result.output.message.split("\n").filter(isBulletLine).length;
  if (result.status === "awaiting_approval") {
    await logEvent(agentId, "approval_needed", `Waiting for approval to post ${bullets} item${bullets === 1 ? "" : "s"}`, { runId: result.runId });
  } else {
    const msg = result.output.posted ? `Posted ${bullets} item${bullets === 1 ? "" : "s"}` : "Nothing new — skipped post";
    await logEvent(agentId, "run_succeeded", msg, { runId: result.runId, costUsd: result.costUsd });
  }
  if (agent.status === "live") await updateAgent(agentId, { nextRunAt: nextRunAt(agent.schedule) });
}

/**
 * Non-durable full run (load, execute, consequences). The routes use the durable workflow instead
 * (src/lib/runtime/start-run.ts); this is the same logic in one call, handy for scripts/fallback.
 */
export async function runAgent(agentId: string, kind: "scheduled" | "manual", runId?: string): Promise<ExecResult | null> {
  let prepared: PreparedRun | null;
  if (runId) {
    const loaded = await loadRun(agentId);
    prepared = loaded ? { ...loaded, runId } : null;
  } else {
    prepared = await prepareRun(agentId, kind);
  }
  if (!prepared) return null;
  const result = await executeSpec({ agentId, kind, ...prepared });
  await afterLiveRun(agentId, result);
  return result;
}
