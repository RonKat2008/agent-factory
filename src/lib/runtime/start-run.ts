// Starts a durable live run. Creates the run row first so callers can return runId immediately.
import { start } from "workflow/api";
import { runAgentWorkflow } from "@/workflows/run-agent";
import { failRun, prepareRun, type LiveKind, type TriggerContext } from "./run-agent";

/** `trigger` is the upstream post for kind "triggered" (chains); other runs of a chained agent get a sample. */
export async function startAgentRun(agentId: string, kind: LiveKind, trigger?: TriggerContext): Promise<string | null> {
  const prepared = await prepareRun(agentId, kind);
  if (!prepared) return null;
  try {
    await start(runAgentWorkflow, [{ agentId, kind, runId: prepared.runId, ...(trigger ? { trigger } : {}) }]);
  } catch (e) {
    await failRun(prepared.runId, `could not start workflow: ${(e as Error).message}`);
    throw e;
  }
  return prepared.runId;
}
