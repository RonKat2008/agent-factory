import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { activateVersion, dryRunOutcome, logEdited } from "@/lib/factory/pipeline";
import { getAgent, getVersion } from "@/lib/repo";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function POST(_req: Request, ctx: { params: Promise<{ id: string; v: string }> }): Promise<Response> {
  return guard("POST /api/agents/:id/versions/:v/accept", async () => {
    const { id, v } = await ctx.params;
    const num = Number(v);
    if (!UUID_RE.test(id) || !Number.isInteger(num) || num < 1) return jsonError("invalid id or version", 400);
    const version = await getVersion(id, num);
    if (!version) return jsonError("version not found", 404);
    if (version.status !== "proposed") return jsonError(`version is ${version.status}, not proposed`, 409);
    const limited = await rateLimit("accept", { global: { max: 30, windowSec: 3600 } });
    if (limited) return limited;
    const out = await dryRunOutcome(id, version.spec);
    if (!out.passed) return jsonError(out.failures.join("; ") || "tests failed", 409);
    await activateVersion(id, num, version.spec);
    await logEdited(id, num, version.reason.replace(/^(user edit|feedback): /, ""), out);
    return json({ agent: await getAgent(id) });
  });
}
