// Durable self-repair: diagnose a broken agent, patch its spec, dry-run the patch with a new
// regression test, ship it as a new version and kick a normal run. Started by repair-hook.ts.
// Every step catches its own errors (steps that throw are retried, which would duplicate rows).
import type { AgentSpec } from "@/lib/spec";
import type { LinkCandidate } from "@/lib/factory/link-candidates";

export type RepairWorkflowInput = { agentId: string; runId: string };

type RepairCtx = {
  agentId: string;
  agentName: string;
  runId: string;
  version: number;
  spec: AgentSpec;
  deadUrl: string | null;
};

type Attempt = {
  ok: boolean;
  diagnosis: string;
  method: "llm" | "fallback" | "none";
  spec: AgentSpec | null;
  runId: string | null;
  testsPassed: number;
  testsTotal: number;
  failure: string;
  fallbackAvailable: boolean;
};

const MAX_ATTEMPTS = 2;

export async function repairAgentWorkflow(input: RepairWorkflowInput) {
  "use workflow";
  const { agentId, runId } = input;
  try {
    const guard = await guardStep(agentId, runId);
    if (guard.skip) return { status: "skipped" as const };

    const ctx = await beginStep(agentId, runId);
    if ("error" in ctx) {
      await needsHumanStep(agentId, ctx.error);
      return { status: "needs_human" as const };
    }

    const candidates = ctx.deadUrl ? await candidatesStep(agentId, ctx.deadUrl) : [];

    let attempt: Attempt | null = null;
    let usedFallback = false;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const preferFallback = i > 0 && !usedFallback && (attempt?.fallbackAvailable ?? false);
      const previous = attempt ? { diagnosis: attempt.diagnosis, failure: attempt.failure } : null;
      attempt = await attemptStep(ctx, candidates, previous, preferFallback);
      if (attempt.method === "fallback") usedFallback = true;
      if (attempt.ok) break;
      if (attempt.method === "none") break;
    }

    if (!attempt || !attempt.ok || !attempt.spec) {
      await needsHumanStep(agentId, attempt?.failure || "no patch could be produced");
      return { status: "needs_human" as const };
    }
    const version = await shipStep(ctx, attempt);
    if (version === null) {
      await needsHumanStep(agentId, "could not save the patched version");
      return { status: "needs_human" as const };
    }
    await startRunStep(agentId);
    return { status: "repaired" as const, version };
  } catch (e) {
    await needsHumanStep(agentId, `repair crashed: ${e instanceof Error ? e.message : String(e)}`);
    return { status: "needs_human" as const };
  }
}

/** Loop guard: a version the factory shipped broke again right after a repair → hand to a human. */
async function guardStep(agentId: string, runId: string): Promise<{ skip: boolean }> {
  "use step";
  const { recentRepairLoop } = await import("@/lib/runtime/repair-hook");
  try {
    if (!(await recentRepairLoop(agentId, runId))) return { skip: false };
    const { logEvent, updateAgent } = await import("@/lib/repo");
    await updateAgent(agentId, { status: "needs_human" });
    await logEvent(agentId, "needs_human", "Repeated failure right after a repair — needs a human", { runId });
    return { skip: true };
  } catch (e) {
    console.error("[repair] guard failed:", (e as Error).message);
    return { skip: false };
  }
}

async function beginStep(agentId: string, runId: string): Promise<RepairCtx | { error: string }> {
  "use step";
  const { getActiveVersion, getAgent, getRun, logEvent, updateAgent } = await import("@/lib/repo");
  const { failingStepOf } = await import("@/lib/factory/repair");
  try {
    await updateAgent(agentId, { status: "repairing" });
    await logEvent(agentId, "repairing", "Diagnosing the failure…", { runId });
    const [agent, active, run] = await Promise.all([getAgent(agentId), getActiveVersion(agentId), getRun(runId)]);
    if (!agent || !active || !run) return { error: "agent, active version or failing run not found" };
    const failing = failingStepOf(run);
    const url = failing?.block === "fetch_url" ? (failing.input as { url?: unknown } | null)?.url : null;
    return {
      agentId,
      agentName: agent.name,
      runId,
      version: active.version,
      spec: active.spec,
      deadUrl: typeof url === "string" ? url : null,
    };
  } catch (e) {
    return { error: `could not load the failure: ${(e as Error).message}` };
  }
}

function siteLabel(foundOn: string): string {
  try {
    const u = new URL(foundOn);
    if (u.pathname.endsWith("sitemap.xml")) return `${u.host} sitemap`;
    const last = u.pathname.split("/").filter(Boolean).pop();
    const name = last ? last.charAt(0).toUpperCase() + last.slice(1) : u.host;
    return `${name} homepage`;
  } catch {
    return "The site";
  }
}

async function candidatesStep(agentId: string, deadUrl: string): Promise<LinkCandidate[]> {
  "use step";
  const { findLinkCandidates } = await import("@/lib/factory/link-candidates");
  const { logEvent } = await import("@/lib/repo");
  try {
    const candidates = await findLinkCandidates(deadUrl);
    const top = candidates[0];
    if (top) {
      const path = new URL(top.url).pathname;
      const msg = top.text
        ? `${siteLabel(top.foundOn)} now links “${top.text}” → ${path} (${top.status}) — testing it`
        : `Found ${path} in the ${siteLabel(top.foundOn)} (${top.status}) — testing it`;
      await logEvent(agentId, "repairing", msg, { candidates: candidates.slice(0, 3) });
    } else {
      await logEvent(agentId, "repairing", `No replacement page found on ${new URL(deadUrl).host} — asking the model`, { deadUrl });
    }
    return candidates;
  } catch (e) {
    console.error("[repair] candidates failed:", (e as Error).message);
    return [];
  }
}

async function attemptStep(
  ctx: RepairCtx,
  candidates: LinkCandidate[],
  previous: { diagnosis: string; failure: string } | null,
  preferFallback: boolean,
): Promise<Attempt> {
  "use step";
  const { getLastSuccessfulRun, getRun, addRunCost } = await import("@/lib/repo");
  const { diagnoseAndPatch, deterministicPatch } = await import("@/lib/factory/repair");
  const { dryRun } = await import("@/lib/runtime/run-agent");
  const empty = { spec: null, runId: null, testsPassed: 0, testsTotal: 0 };
  try {
    const [failingRun, lastGoodRun] = await Promise.all([getRun(ctx.runId), getLastSuccessfulRun(ctx.agentId)]);
    if (!failingRun) return { ok: false, diagnosis: "", method: "none", failure: "failing run not found", fallbackAvailable: false, ...empty };
    const input = { spec: ctx.spec, failingRun, lastGoodRun, candidates, previousAttempt: previous, preferFallback };
    const fallbackAvailable = deterministicPatch(input) !== null;
    const patch = await diagnoseAndPatch(input);
    if (!patch) {
      return { ok: false, diagnosis: "", method: "none", failure: "no safe patch found (no verified replacement page)", fallbackAvailable, ...empty };
    }
    const restore = await rebaselineIfSourceMoved(ctx, patch.spec);
    const res = await dryRun(ctx.agentId, patch.spec, "repair_test");
    if (res.status === "failed") await restore();
    if (patch.costUsd > 0) await addRunCost(res.runId, patch.costUsd);
    const testsTotal = patch.spec.tests.length;
    const testsPassed = res.stepError ? 0 : res.tests.length - res.failedTests.length;
    const failure = res.stepError
      ? `step "${res.stepError.stepId}" failed: ${res.stepError.error}`
      : res.failedTests.map((t) => `${t.kind}: ${t.detail}`).join("; ");
    return {
      ok: res.status !== "failed",
      diagnosis: patch.diagnosis,
      method: patch.method,
      spec: patch.spec,
      runId: res.runId,
      testsPassed,
      testsTotal,
      failure: res.status === "failed" ? failure || "dry run failed" : "",
      fallbackAvailable,
    };
  } catch (e) {
    return { ok: false, diagnosis: "", method: "none", failure: `repair attempt crashed: ${(e as Error).message}`, fallbackAvailable: false, ...empty };
  }
}

function sourceUrls(spec: AgentSpec): string[] {
  return spec.steps.flatMap((s) => (s.block === "fetch_url" || s.block === "fetch_rss" ? [s.params.url] : []));
}

/**
 * A moved source page has a new layout, so diff memory taken from the old page would report the
 * page chrome as "new entries". Re-baseline memory on the new page (so only genuinely new entries
 * get posted) and return an undo for when the patch fails its dry run.
 */
async function rebaselineIfSourceMoved(ctx: RepairCtx, patched: AgentSpec): Promise<() => Promise<void>> {
  const noop = async () => {};
  if (JSON.stringify(sourceUrls(ctx.spec)) === JSON.stringify(sourceUrls(patched))) return noop;
  const { memoryGet, memorySet } = await import("@/lib/repo");
  const { baselineMemory } = await import("@/lib/runtime/run-agent");
  const keys = patched.steps.flatMap((s) => (s.block === "diff_with_memory" ? [s.params.memoryKey] : []));
  if (keys.length === 0) return noop;
  const snapshot = await Promise.all(keys.map(async (k) => [k, await memoryGet(ctx.agentId, k)] as const));
  const b = await baselineMemory(ctx.agentId, patched);
  if (!b.ok) console.error("[repair] re-baseline failed:", b.error);
  return async () => {
    for (const [k, v] of snapshot) await memorySet(ctx.agentId, k, v);
  };
}

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function shipStep(ctx: RepairCtx, attempt: Attempt): Promise<number | null> {
  "use step";
  const { insertVersion, logEvent, updateAgent } = await import("@/lib/repo");
  const { nextRunAt } = await import("@/lib/runtime/schedule");
  const { postFactoryMessage } = await import("@/lib/runtime/deliver");
  try {
    const spec = attempt.spec!;
    const version = await insertVersion({
      agentId: ctx.agentId,
      spec,
      reason: `auto-repair: ${attempt.diagnosis}`,
      createdBy: "factory",
      parentVersion: ctx.version,
    });
    await updateAgent(ctx.agentId, { currentVersion: version, status: "live", nextRunAt: nextRunAt(spec.schedule) });
    const data = { runId: attempt.runId, failedRunId: ctx.runId, version, method: attempt.method };
    await logEvent(ctx.agentId, "tests_passed", `Patched spec passed ${attempt.testsPassed}/${attempt.testsTotal} tests on a dry run`, data);
    await logEvent(ctx.agentId, "repaired", `Fixed: ${attempt.diagnosis}. Shipped v${version} with +1 regression test.`, data);
    await postFactoryMessage(
      `🔧 I fixed *${ctx.agentName}*: ${attempt.diagnosis}. Shipped v${version} (+1 regression test). <${appUrl()}/agents/${ctx.agentId}|See the diff>`,
      ctx.agentId,
    );
    return version;
  } catch (e) {
    console.error("[repair] ship failed:", (e as Error).message);
    return null;
  }
}

async function startRunStep(agentId: string): Promise<void> {
  "use step";
  try {
    const { startAgentRun } = await import("@/lib/runtime/start-run");
    await startAgentRun(agentId, "manual");
  } catch (e) {
    console.error("[repair] could not start the post-repair run:", (e as Error).message);
  }
}

async function needsHumanStep(agentId: string, reason: string): Promise<void> {
  "use step";
  const { getAgent, logEvent, updateAgent } = await import("@/lib/repo");
  const { postFactoryMessage } = await import("@/lib/runtime/deliver");
  try {
    const agent = await getAgent(agentId);
    await updateAgent(agentId, { status: "needs_human" });
    await logEvent(agentId, "needs_human", `Couldn't fix it automatically: ${reason}`, { reason });
    await postFactoryMessage(
      `⚠️ I couldn't fix *${agent?.name ?? "an agent"}*: ${reason}. <${appUrl()}/agents/${agentId}|Take a look>`,
      agentId,
    );
  } catch (e) {
    console.error("[repair] needs_human step failed:", (e as Error).message);
  }
}
