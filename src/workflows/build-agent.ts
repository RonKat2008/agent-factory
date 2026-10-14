// Durable builder: request -> spec -> dry run -> tests -> (up to 2) self-fixes -> ready | needs_human.
import { reviseSpec, generateSpec } from "@/lib/factory/generate";
import { blockChain, dryRunOutcome, type DryOutcome } from "@/lib/factory/pipeline";
import { insertVersion, logEvent, updateAgent } from "@/lib/repo";
import type { AgentSpec } from "@/lib/spec";

export type BuildAgentInput = { agentId: string; request: string };
const MAX_ATTEMPTS = 3;

export async function buildAgentWorkflow(input: BuildAgentInput) {
  "use workflow";
  const { agentId, request } = input;
  try {
    const built = await generateStep(agentId, request);
    let spec = built.spec;
    let version = built.version;
    let pendingCost = built.costUsd;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const out = await dryStep(agentId, spec, pendingCost);
      pendingCost = 0;
      if (out.passed) {
        await passedStep(agentId, out);
        return { status: "ready" as const, version };
      }
      await failedStep(agentId, out);
      if (attempt === MAX_ATTEMPTS) break;
      const fixed = await reviseStep(agentId, spec, version, out);
      spec = fixed.spec;
      version = fixed.version;
      pendingCost = fixed.costUsd;
    }
    await needsHumanStep(agentId, "Could not get all tests to pass after 3 attempts");
    return { status: "needs_human" as const, version };
  } catch (e) {
    await needsHumanStep(agentId, `Build failed: ${(e as Error).message}`);
    return { status: "needs_human" as const, version: 0 };
  }
}

async function generateStep(agentId: string, request: string): Promise<{ spec: AgentSpec; version: number; costUsd: number }> {
  "use step";
  const { spec, costUsd } = await generateSpec(request);
  const version = await insertVersion({ agentId, spec, reason: "initial build", createdBy: "user", parentVersion: null });
  await updateAgent(agentId, {
    name: spec.name,
    schedule: spec.schedule,
    requiresApproval: spec.requiresApproval,
    currentVersion: version,
    status: "testing",
  });
  await logEvent(agentId, "built", `Generated spec: ${blockChain(spec)}`, { version });
  return { spec, version, costUsd };
}

async function dryStep(agentId: string, spec: AgentSpec, pendingCost: number): Promise<DryOutcome> {
  "use step";
  const out = await dryRunOutcome(agentId, spec, pendingCost);
  await logEvent(agentId, "dry_run", `Dry run finished in ${out.seconds.toFixed(1)}s — ${out.testsPassed}/${out.testsTotal} tests passed`, {
    runId: out.runId,
  });
  return out;
}

async function passedStep(agentId: string, out: DryOutcome): Promise<void> {
  "use step";
  await logEvent(agentId, "tests_passed", `${out.testsPassed}/${out.testsTotal} tests passed`, { runId: out.runId });
  await updateAgent(agentId, { status: "ready" });
}

async function failedStep(agentId: string, out: DryOutcome): Promise<void> {
  "use step";
  await logEvent(agentId, "test_failed", out.failures.join("; ").slice(0, 500), { runId: out.runId, failures: out.failures });
}

async function reviseStep(agentId: string, spec: AgentSpec, parent: number, out: DryOutcome): Promise<{ spec: AgentSpec; version: number; costUsd: number }> {
  "use step";
  const fixed = await reviseSpec(spec, out.failures, out.stepSummaries);
  const version = await insertVersion({
    agentId,
    spec: fixed.spec,
    reason: `self-fix: ${fixed.changeSummary}`,
    createdBy: "factory",
    parentVersion: parent,
  });
  await updateAgent(agentId, { currentVersion: version, schedule: fixed.spec.schedule, requiresApproval: fixed.spec.requiresApproval });
  await logEvent(agentId, "self_fixed", `↻ ${fixed.changeSummary}`, { version });
  return { spec: fixed.spec, version, costUsd: fixed.costUsd };
}

async function needsHumanStep(agentId: string, message: string): Promise<void> {
  "use step";
  await updateAgent(agentId, { status: "needs_human" });
  await logEvent(agentId, "needs_human", message.slice(0, 500));
}
