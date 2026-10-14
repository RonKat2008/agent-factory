import { z } from "zod";
import { guard, json, jsonError } from "@/lib/api-util";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { NOT_CONFIGURED, SessionId, eveFetch, opsConfig, upstreamError } from "../upstream";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({ sessionId: SessionId, requestId: z.string().min(1).max(200), approve: z.boolean() });

/** Answers a pending tool-approval request: approve -> optionId "approve", deny -> "cancel". */
export function POST(req: Request): Promise<Response> {
  return guard("POST /api/ops/approve", async () => {
    if (!opsConfig()) return NOT_CONFIGURED();
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return jsonError("body must be { sessionId, requestId, approve }", 400);
    const limited = await rateLimit("ops-approve", { key: clientIp(req), perKey: { max: 20, windowSec: 600 }, global: { max: 200, windowSec: 3600 } });
    if (limited) return limited;
    const { sessionId, requestId, approve } = body.data;
    const res = await eveFetch(`/session/${sessionId}`, {
      method: "POST",
      json: { inputResponses: [{ requestId, optionId: approve ? "approve" : "cancel" }] },
    });
    if (!res.ok) return upstreamError(res);
    return json({ ok: true });
  });
}
