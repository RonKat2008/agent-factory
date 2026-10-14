import { guard, json, jsonError } from "@/lib/api-util";
import { start } from "workflow/api";
import { z } from "zod";
import { createAgent, listAgents, logEvent, updateAgent } from "@/lib/repo";
import { buildAgentWorkflow } from "@/workflows/build-agent";

export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
  return guard("GET /api/agents", async () => json({ agents: await listAgents() }));
}

const BodySchema = z.object({ request: z.string().trim().min(8).max(600) });
const DEFAULT_SCHEDULE = "0 16 * * *";

export function POST(req: Request): Promise<Response> {
  return guard("POST /api/agents", async () => {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("request must be 8-600 characters", 400);
    const { request } = parsed.data;
    const agentId = await createAgent({ name: "New agent", request, schedule: DEFAULT_SCHEDULE, status: "building", requiresApproval: false });
    try {
      await start(buildAgentWorkflow, [{ agentId, request }]);
    } catch (e) {
      await updateAgent(agentId, { status: "needs_human" });
      await logEvent(agentId, "needs_human", `Could not start build: ${(e as Error).message}`);
    }
    return Response.json({ agentId }, { status: 201 });
  });
}
