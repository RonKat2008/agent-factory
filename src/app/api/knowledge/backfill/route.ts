import { guard, json, jsonError } from "@/lib/api-util";
import { isAdmin } from "@/lib/demo-acme";
import { backfillKnowledge } from "@/lib/knowledge";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Extracts entities from the last 40 outbox messages so the graph isn't empty. Key-gated. */
export function POST(request: Request): Promise<Response> {
  return guard("POST /api/knowledge/backfill", async () => {
    if (!isAdmin(request)) return jsonError("unauthorized", 401);
    return json(await backfillKnowledge(40));
  });
}
