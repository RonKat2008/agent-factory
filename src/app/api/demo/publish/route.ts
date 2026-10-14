import { guard, json, jsonError } from "@/lib/api-util";
import { extraEntries, getAcmeState, isAdmin, setAcmeState } from "@/lib/demo-acme";

export const dynamic = "force-dynamic";

/** Acme ships the next entry from the pool (appears at the top of the changelog). */
export function POST(request: Request): Promise<Response> {
  return guard("POST /api/demo/publish", async () => {
    if (!isAdmin(request)) return jsonError("unauthorized", 401);
    const state = await getAcmeState();
    const published = Math.min(state.published + 1, extraEntries.length);
    await setAcmeState({ published });
    return json({ ok: true, published });
  });
}
