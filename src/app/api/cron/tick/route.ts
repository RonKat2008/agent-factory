import { guard, json, jsonError } from "@/lib/api-util";
import { claimAgent, getAgent, listDueAgentIds } from "@/lib/repo";
import { nextRunAt } from "@/lib/runtime/schedule";
import { startAgentRun } from "@/lib/runtime/start-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function GET(request: Request): Promise<Response> {
  return guard("GET /api/cron/tick", async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return jsonError("unauthorized", 401);
    const now = new Date();
    const due = await listDueAgentIds(now);
    const started: string[] = [];
    for (const d of due) {
      const agent = await getAgent(d.id);
      if (!agent) continue;
      const claimed = await claimAgent(d.id, d.nextRunAt, nextRunAt(agent.schedule, now));
      if (!claimed) continue;
      try {
        const runId = await startAgentRun(d.id, "scheduled");
        if (runId) started.push(runId);
      } catch (e) {
        console.error("[cron] failed to start run for", d.id, e);
      }
    }
    return json({ started });
  });
}
