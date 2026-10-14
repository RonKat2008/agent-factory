import { guard, json, jsonError } from "@/lib/api-util";
import { isAdmin, setAcmeState } from "@/lib/demo-acme";

export const dynamic = "force-dynamic";

/** Acme "redesigns": changelog moves to /demo/acme/updates and the old URL 404s. */
export function POST(request: Request): Promise<Response> {
  return guard("POST /api/demo/break", async () => {
    if (!isAdmin(request)) return jsonError("unauthorized", 401);
    await setAcmeState({ broken: true });
    return json({ ok: true, broken: true });
  });
}
