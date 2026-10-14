import { guard, json, jsonError } from "@/lib/api-util";
import { isAdmin } from "@/lib/demo-acme";
import { publishAcme } from "@/lib/demo-actions";

export const dynamic = "force-dynamic";

/** Acme ships the next entry from the pool (appears at the top of the changelog). */
export function POST(request: Request): Promise<Response> {
  return guard("POST /api/demo/publish", async () => {
    if (!isAdmin(request)) return jsonError("unauthorized", 401);
    return json(await publishAcme());
  });
}
