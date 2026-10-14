import { start } from "workflow/api";
import { UUID_RE, guard, jsonError } from "@/lib/api-util";
import { getVersion, logEvent } from "@/lib/repo";
import { rateLimit } from "@/lib/rate-limit";
import { editAgentWorkflow } from "@/workflows/edit-agent";

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
    const summary = version.reason.replace(/^(user edit|feedback): /, "");
    await logEvent(id, "proposed", `Testing v${num} before activating…`, { version: num });
    // Dry run + activation (or rejection) happen durably in the workflow, so the click can't 504.
    await start(editAgentWorkflow, [{ agentId: id, version: num, changeSummary: summary, autoActivate: true }]);
    return Response.json({ accepted: "testing" }, { status: 202, headers: { "Cache-Control": "no-store" } });
  });
}
