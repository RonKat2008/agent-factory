import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { getVersion, setVersionStatus } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function POST(_req: Request, ctx: { params: Promise<{ id: string; v: string }> }): Promise<Response> {
  return guard("POST /api/agents/:id/versions/:v/reject", async () => {
    const { id, v } = await ctx.params;
    const num = Number(v);
    if (!UUID_RE.test(id) || !Number.isInteger(num) || num < 1) return jsonError("invalid id or version", 400);
    const version = await getVersion(id, num);
    if (!version) return jsonError("version not found", 404);
    if (version.status !== "proposed") return jsonError(`version is ${version.status}, not proposed`, 409);
    await setVersionStatus(id, num, "rejected");
    return json({ ok: true });
  });
}
