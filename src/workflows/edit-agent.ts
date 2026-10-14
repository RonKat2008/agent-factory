// Durable edit/feedback check: dry-run a proposed version; activate it on success (edit mode) or just report (propose mode).
import { reviseSpec } from "@/lib/factory/generate";
import { activateVersion, dryRunOutcome, logEdited, type DryOutcome } from "@/lib/factory/pipeline";
import { getVersion, insertVersion, logEvent, setVersionStatus } from "@/lib/repo";
import type { AgentSpec } from "@/lib/spec";

export type EditAgentInput = { agentId: string; version: number; changeSummary: string; autoActivate: boolean };

export async function editAgentWorkflow(input: EditAgentInput) {
  "use workflow";
  const { agentId, changeSummary, autoActivate } = input;
  try {
    const spec = await loadSpecStep(agentId, input.version);
    if (!spec) return { status: "missing" as const };
    const first = await dryStep(agentId, spec);
    if (!autoActivate) {
      await proposedStep(agentId, input.version, changeSummary, first);
      return { status: "proposed" as const };
    }
    if (first.passed) {
      await activateStep(agentId, input.version, spec, changeSummary, first);
      return { status: "active" as const, version: input.version };
    }
    await failedStep(agentId, first);
    const fixed = await reviseStep(agentId, spec, input.version, first);
    const second = await dryStep(agentId, fixed.spec, fixed.costUsd);
    if (second.passed) {
      await rejectStep(agentId, input.version);
      await activateStep(agentId, fixed.version, fixed.spec, `${changeSummary} (after self-fix: ${fixed.changeSummary})`, second);
      return { status: "active" as const, version: fixed.version };
    }
    await failedStep(agentId, second);
    await rejectStep(agentId, input.version);
    await rejectStep(agentId, fixed.version);
    return { status: "rejected" as const };
  } catch (e) {
    await logEvent(agentId, "test_failed", `Edit check crashed: ${(e as Error).message}`.slice(0, 500));
    return { status: "rejected" as const };
  }
}

async function loadSpecStep(agentId: string, version: number): Promise<AgentSpec | null> {
  "use step";
  return (await getVersion(agentId, version))?.spec ?? null;
}

async function dryStep(agentId: string, spec: AgentSpec, pendingCost = 0): Promise<DryOutcome> {
  "use step";
  return dryRunOutcome(agentId, spec, pendingCost);
}

async function activateStep(agentId: string, version: number, spec: AgentSpec, summary: string, out: DryOutcome): Promise<void> {
  "use step";
  await activateVersion(agentId, version, spec);
  await logEdited(agentId, version, summary, out);
}

async function proposedStep(agentId: string, version: number, summary: string, out: DryOutcome): Promise<void> {
  "use step";
  const verdict = out.passed ? `${out.testsPassed}/${out.testsTotal} tests pass` : `tests failing: ${out.failures.join("; ")}`.slice(0, 300);
  await logEvent(agentId, "proposed", `Proposed v${version} from feedback: ${summary} (${verdict})`, { version, runId: out.runId, passed: out.passed });
}

async function failedStep(agentId: string, out: DryOutcome): Promise<void> {
  "use step";
  await logEvent(agentId, "test_failed", out.failures.join("; ").slice(0, 500), { runId: out.runId, failures: out.failures });
}

async function reviseStep(agentId: string, spec: AgentSpec, parent: number, out: DryOutcome): Promise<{ spec: AgentSpec; version: number; changeSummary: string; costUsd: number }> {
  "use step";
  const fixed = await reviseSpec(spec, out.failures, out.stepSummaries);
  const version = await insertVersion({
    agentId,
    spec: fixed.spec,
    reason: `self-fix: ${fixed.changeSummary}`,
    createdBy: "factory",
    parentVersion: parent,
    status: "proposed",
  });
  await logEvent(agentId, "self_fixed", `↻ ${fixed.changeSummary}`, { version });
  return { spec: fixed.spec, version, changeSummary: fixed.changeSummary, costUsd: fixed.costUsd };
}

async function rejectStep(agentId: string, version: number): Promise<void> {
  "use step";
  await setVersionStatus(agentId, version, "rejected");
}
