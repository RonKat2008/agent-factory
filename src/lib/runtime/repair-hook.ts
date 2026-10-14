// Called by runAgent when a live agent breaks: starts the durable self-repair workflow.
import { start } from "workflow/api";
import { getRun, getVersion, listEvents, logEvent, updateAgent } from "@/lib/repo";
import { repairAgentWorkflow } from "@/workflows/repair-agent";

const LOOP_WINDOW_MS = 90_000;

/**
 * True when a factory-shipped version broke within 90s of a repair/needs_human event:
 * repairing again would loop, so a human takes over.
 */
export async function recentRepairLoop(agentId: string, runId: string): Promise<boolean> {
  const since = new Date(Date.now() - LOOP_WINDOW_MS).toISOString();
  const recent = await listEvents({ agentId, since, limit: 50 });
  if (!recent.some((e) => e.type === "repaired" || e.type === "needs_human")) return false;
  const run = await getRun(runId);
  if (!run) return false;
  const version = await getVersion(agentId, run.version);
  return version?.createdBy === "factory";
}

export async function triggerRepair(agentId: string, runId: string): Promise<void> {
  try {
    await start(repairAgentWorkflow, [{ agentId, runId }]);
  } catch (e) {
    const reason = `could not start repair: ${(e as Error).message}`;
    console.error("[repair-hook]", reason);
    try {
      await updateAgent(agentId, { status: "needs_human" });
      await logEvent(agentId, "needs_human", `Couldn't fix it automatically: ${reason}`, { runId });
    } catch (inner) {
      console.error("[repair-hook] could not record needs_human:", (inner as Error).message);
    }
  }
}
