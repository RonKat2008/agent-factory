import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { getActiveVersion, getAgent } from "@/lib/repo";
import { agentSlug, specToEveProject } from "@/lib/export-eve";
import { zipFiles } from "@/lib/zip";

export const dynamic = "force-dynamic";

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("GET /api/agents/:id/export", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const [agent, active] = await Promise.all([getAgent(id), getActiveVersion(id)]);
    if (!agent || !active) return jsonError("not found", 404);

    const url = new URL(req.url);
    const files = specToEveProject(active.spec, { factoryUrl: url.origin, agentId: id, version: active.version });
    if (url.searchParams.get("format") === "json") return json({ files });

    const bytes = zipFiles(files);
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename=${agentSlug(active.spec.name)}-eve.zip`,
        "cache-control": "no-store",
      },
    });
  });
}
