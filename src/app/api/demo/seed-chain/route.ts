import { guard, json, jsonError } from "@/lib/api-util";
import { isAdmin } from "@/lib/demo-acme";
import { seedChainAgent } from "@/lib/demo-actions";

export const dynamic = "force-dynamic";

/** Idempotent, key-gated: adds ONLY the chained "Competitor deep-dive" (triggered by the Competitor watcher). */
export function POST(request: Request): Promise<Response> {
  return guard("POST /api/demo/seed-chain", async () => {
    if (!isAdmin(request)) return jsonError("unauthorized", 401);
    const result = await seedChainAgent();
    if (!result.ok) return jsonError(result.error, 409);
    return json(result);
  });
}
