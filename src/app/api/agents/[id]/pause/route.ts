import { z } from "zod";
import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { getAgent, logEvent, updateAgent } from "@/lib/repo";
import { nextRunAt } from "@/lib/runtime/schedule";

export const dynamic = "force-dynamic";

const Body = z.object({ paused: z.boolean() });

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("POST /api/agents/:id/pause", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return jsonError("body must be { paused: boolean }", 400);
    const agent = await getAgent(id);
    if (!agent) return jsonError("not found", 404);
    if (body.data.paused) {
      await updateAgent(id, { status: "paused" });
      await logEvent(id, "paused", "Paused");
    } else {
      await updateAgent(id, { status: "live", nextRunAt: nextRunAt(agent.schedule) });
      await logEvent(id, "resumed", "Resumed");
    }
    return json({ agent: await getAgent(id) });
  });
}
