import { guard, json, jsonError, UUID_RE } from "@/lib/api-util";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { agent_id: string; url: string | null; snippet: string | null; created_at: string | Date };

/** Recent mentions of one knowledge entity, with source links, for the graph side panel. */
export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("GET /api/graph/entity/[id]", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid entity id", 400);
    let rows: Row[] = [];
    try {
      rows = await query<Row>(
        `select agent_id, url, snippet, created_at from kg_mentions where entity_id = $1 order by created_at desc limit 12`,
        [id],
      );
    } catch {
      rows = []; // knowledge tables not migrated yet
    }
    return json({
      mentions: rows.map((r) => ({
        agentId: String(r.agent_id),
        url: r.url && /^https?:\/\//i.test(r.url) ? r.url : null,
        snippet: r.snippet,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    });
  });
}
