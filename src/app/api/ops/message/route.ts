import { z } from "zod";
import { guard, json, jsonError } from "@/lib/api-util";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { NOT_CONFIGURED, SessionId, eveFetch, opsConfig, upstreamError } from "../upstream";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({ sessionId: SessionId, text: z.string().trim().min(1).max(2000) });

export function POST(req: Request): Promise<Response> {
  return guard("POST /api/ops/message", async () => {
    if (!opsConfig()) return NOT_CONFIGURED();
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return jsonError("body must be { sessionId, text (1-2000 chars) }", 400);
    const limited = await rateLimit("ops-message", { key: clientIp(req), perKey: { max: 20, windowSec: 600 }, global: { max: 200, windowSec: 3600 } });
    if (limited) return limited;
    const res = await eveFetch(`/session/${body.data.sessionId}`, { method: "POST", json: { message: body.data.text } });
    if (!res.ok) return upstreamError(res);
    return json({ ok: true });
  });
}
