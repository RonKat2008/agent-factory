// Called by runAgent when a live agent breaks. Task 6 replaces the body with the repair loop.
import { logEvent } from "@/lib/repo";

export async function triggerRepair(agentId: string, runId: string): Promise<void> {
  await logEvent(agentId, "needs_human", "Repair not implemented yet", { runId });
}
