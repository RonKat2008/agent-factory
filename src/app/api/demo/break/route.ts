import { guard, json, jsonError } from "@/lib/api-util";
import { isAdmin } from "@/lib/demo-acme";
import { breakAcme } from "@/lib/demo-actions";

export const dynamic = "force-dynamic";

/** Acme "redesigns": changelog moves to /demo/acme/updates and the old URL 404s. */
export function POST(request: Request): Promise<Response> {
  return guard("POST /api/demo/break", async () => {
    if (!isAdmin(request)) return jsonError("unauthorized", 401);
    return json(await breakAcme());
  });
}
