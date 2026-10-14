import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { getRun } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("GET /api/runs/:id", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const run = await getRun(id);
    return run ? json({ run }) : jsonError("not found", 404);
  });
}
