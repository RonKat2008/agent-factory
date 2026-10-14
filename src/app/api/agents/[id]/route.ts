import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { getAgentDetail } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("GET /api/agents/:id", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const detail = await getAgentDetail(id);
    return detail ? json(detail) : jsonError("not found", 404);
  });
}
