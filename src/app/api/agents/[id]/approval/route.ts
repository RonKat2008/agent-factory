import { z } from "zod";
import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { getAgent, updateAgent } from "@/lib/repo";

export const dynamic = "force-dynamic";

const Body = z.object({ requiresApproval: z.boolean() });

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("POST /api/agents/:id/approval", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return jsonError("body must be { requiresApproval: boolean }", 400);
    if (!(await getAgent(id))) return jsonError("not found", 404);
    await updateAgent(id, { requiresApproval: body.data.requiresApproval });
    return json({ agent: await getAgent(id) });
  });
}
