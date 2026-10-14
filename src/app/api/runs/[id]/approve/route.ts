import { z } from "zod";
import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { finishRun, getAgent, getRun, logEvent } from "@/lib/repo";
import { deliver } from "@/lib/runtime/deliver";
import { fireTriggers } from "@/lib/runtime/run-agent";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ approve: z.boolean() });

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("POST /api/runs/:id/approve", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("approve (boolean) required", 400);
    const run = await getRun(id);
    if (!run) return jsonError("run not found", 404);
    if (run.status !== "awaiting_approval" || !run.output) return jsonError(`run is ${run.status}, not awaiting_approval`, 409);
    if (parsed.data.approve) {
      await deliver({ agentId: run.agentId, runId: id, message: run.output.message });
      await finishRun(id, { status: "succeeded", output: { ...run.output, posted: true }, error: run.error });
      await logEvent(run.agentId, "run_succeeded", "Approved and posted", { runId: id });
      const agent = await getAgent(run.agentId);
      await fireTriggers(run.agentId, agent?.name ?? "upstream agent", id, { ...run.output, posted: true });
    } else {
      await finishRun(id, { status: "rejected", output: run.output, error: run.error });
      await logEvent(run.agentId, "run_failed", "Post rejected by human", { runId: id });
    }
    return json({ run: await getRun(id) });
  });
}
