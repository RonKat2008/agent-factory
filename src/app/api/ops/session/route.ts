import { guard, json } from "@/lib/api-util";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { NOT_CONFIGURED, eveFetch, opsConfig, upstreamError } from "../upstream";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Creates an empty, parked eve session; the first message becomes turn_0. */
export function POST(req: Request): Promise<Response> {
  return guard("POST /api/ops/session", async () => {
    if (!opsConfig()) return NOT_CONFIGURED();
    const limited = await rateLimit("ops-session", { key: clientIp(req), perKey: { max: 10, windowSec: 600 }, global: { max: 100, windowSec: 3600 } });
    if (limited) return limited;
    const res = await eveFetch("/session", { method: "POST", json: {} });
    if (!res.ok) return upstreamError(res);
    const body = (await res.json().catch(() => null)) as { sessionId?: string } | null;
    if (!body?.sessionId) return upstreamError(new Response(null, { status: 502 }));
    return json({ sessionId: body.sessionId });
  });
}
