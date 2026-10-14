import { guard, json, jsonError } from "@/lib/api-util";
import { isAdmin } from "@/lib/demo-acme";
import { resetDemo } from "@/lib/demo-actions";

export const dynamic = "force-dynamic";

/** Restores Acme and rolls the Competitor watcher back to v1 with empty memory. */
export function POST(request: Request): Promise<Response> {
  return guard("POST /api/demo/reset", async () => {
    if (!isAdmin(request)) return jsonError("unauthorized", 401);
    return json(await resetDemo());
  });
}
