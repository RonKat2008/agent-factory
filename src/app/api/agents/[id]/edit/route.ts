import { start } from "workflow/api";
import { z } from "zod";
import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { editSpec } from "@/lib/factory/generate";
import { getActiveVersion, getAgent, insertVersion } from "@/lib/repo";
import { editAgentWorkflow } from "@/workflows/edit-agent";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({ instruction: z.string().trim().min(3).max(600) });

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("POST /api/agents/:id/edit", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("instruction must be 3-600 characters", 400);
    const [agent, active] = await Promise.all([getAgent(id), getActiveVersion(id)]);
    if (!agent || !active) return jsonError("agent not found or has no active version", 404);
    const { instruction } = parsed.data;
    const limited = await rateLimit("edit", { key: clientIp(req), perKey: { max: 10, windowSec: 600 }, global: { max: 40, windowSec: 3600 } });
    if (limited) return limited;
    const edited = await editSpec(active.spec, instruction);
    const version = await insertVersion({
      agentId: id,
      spec: edited.spec,
      reason: `user edit: ${instruction}`,
      createdBy: "user",
      parentVersion: active.version,
      status: "proposed",
    });
    await start(editAgentWorkflow, [{ agentId: id, version, changeSummary: edited.changeSummary, autoActivate: true }]);
    return json({ version });
  });
}
