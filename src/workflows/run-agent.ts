// Durable agent run: one workflow step per block, each persisting its own step_run row,
// so a crash mid-run is visible in the run timeline. Started via src/lib/runtime/start-run.ts.
import type { AgentSpec, Step } from "@/lib/spec";
import type { ExecResult, StepError, StepOutcome } from "@/lib/runtime/run-agent";

export type RunAgentWorkflowInput = { agentId: string; kind: "scheduled" | "manual"; runId: string };

export async function runAgentWorkflow(input: RunAgentWorkflowInput) {
  "use workflow";
  const { agentId, kind, runId } = input;
  try {
    const ctx = await loadStep(agentId, runId);
    if (!ctx) return { runId, status: "failed" as const };
    const holdSend = true; // test-gated delivery: send_slack runs dry, finalizeStep delivers if tests pass
    const outputs: Record<string, unknown> = {};
    const outcomes: Record<string, StepOutcome> = {};
    let stepError: StepError | null = null;
    for (let i = 0; i < ctx.spec.steps.length; i++) {
      const step = ctx.spec.steps[i];
      const o = await blockStep(agentId, runId, i, step, outputs, holdSend);
      outcomes[step.id] = o;
      if (!o.ok) {
        stepError = { stepId: step.id, block: step.block, error: o.error ?? "unknown error", input: o.resolvedParams ?? null };
        await skipStep(runId, ctx.spec.steps, i + 1);
        break;
      }
      outputs[step.id] = o.output;
    }
    const result = await finalizeStep(agentId, runId, ctx.spec, outcomes, stepError, ctx.requiresApproval);
    return { runId, status: result.status, kind };
  } catch (e) {
    await failStep(agentId, runId, e instanceof Error ? e.message : String(e));
    return { runId, status: "failed" as const };
  }
}

async function loadStep(agentId: string, runId: string): Promise<{ spec: AgentSpec; requiresApproval: boolean } | null> {
  "use step";
  const { loadRun, failRun } = await import("@/lib/runtime/run-agent");
  const loaded = await loadRun(agentId);
  if (!loaded) {
    await failRun(runId, "agent or active version not found");
    return null;
  }
  return { spec: loaded.spec, requiresApproval: loaded.requiresApproval };
}

async function blockStep(
  agentId: string,
  runId: string,
  idx: number,
  step: Step,
  outputs: Record<string, unknown>,
  holdSend: boolean,
): Promise<StepOutcome> {
  "use step";
  const { executeStepAt } = await import("@/lib/runtime/run-agent");
  return executeStepAt({ agentId, runId, idx, step, outputs, dryRun: false, holdSend });
}

async function skipStep(runId: string, steps: Step[], fromIdx: number): Promise<void> {
  "use step";
  const { skipSteps } = await import("@/lib/runtime/run-agent");
  await skipSteps(runId, steps, fromIdx);
}

async function finalizeStep(
  agentId: string,
  runId: string,
  spec: AgentSpec,
  outcomes: Record<string, StepOutcome>,
  stepError: StepError | null,
  requiresApproval: boolean,
): Promise<ExecResult> {
  "use step";
  const { finalizeExec, afterLiveRun } = await import("@/lib/runtime/run-agent");
  const result = await finalizeExec({ agentId, runId, spec, outcomes, stepError, requiresApproval });
  await afterLiveRun(agentId, result);
  return result;
}

async function failStep(agentId: string, runId: string, message: string): Promise<void> {
  "use step";
  const { failRun, afterLiveRun } = await import("@/lib/runtime/run-agent");
  const result = await failRun(runId, message);
  await afterLiveRun(agentId, result);
}
