import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { listEvents } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(req: Request): Promise<Response> {
  return guard("GET /api/feed", async () => {
    const sp = new URL(req.url).searchParams;
    const since = sp.get("since") ?? undefined;
    const agentId = sp.get("agentId") ?? undefined;
    if (since && Number.isNaN(Date.parse(since))) return jsonError("invalid since", 400);
    if (agentId && !UUID_RE.test(agentId)) return jsonError("invalid agentId", 400);
    return json({ events: await listEvents({ since, agentId, limit: 50 }) });
  });
}
