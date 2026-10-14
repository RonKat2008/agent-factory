import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { getAgent, listAgents, logEvent, updateAgent } from "@/lib/repo";

const MAX_LIVE_AGENTS = 25;

export const dynamic = "force-dynamic";

export function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("POST /api/agents/:id/golive", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const agent = await getAgent(id);
    if (!agent) return jsonError("not found", 404);
    if (agent.status !== "ready") return jsonError(`agent is ${agent.status}, not ready`, 409);
    const live = (await listAgents()).filter((a) => a.status === "live").length;
    if (live >= MAX_LIVE_AGENTS) return jsonError(`the demo fleet already has ${live} live agents; pause one first`, 409);
    await updateAgent(id, { status: "live", nextRunAt: new Date() });
    await logEvent(id, "went_live", `Went live — ${agent.scheduleHuman.toLowerCase()}`);
    return json({ agent: await getAgent(id) });
  });
}
