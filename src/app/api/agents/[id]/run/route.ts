import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { getAgent } from "@/lib/repo";
import { startAgentRun } from "@/lib/runtime/start-run";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("POST /api/agents/:id/run", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const agent = await getAgent(id);
    if (!agent) return jsonError("not found", 404);
    if (agent.status === "building" || agent.status === "testing") return jsonError(`agent is ${agent.status}`, 409);
    const limited = await rateLimit("run", { key: id, perKey: { max: 1, windowSec: 10 }, global: { max: 60, windowSec: 3600 } });
    if (limited) return limited;
    const runId = await startAgentRun(id, "manual");
    if (!runId) return jsonError("agent has no active version", 409);
    return json({ runId });
  });
}
