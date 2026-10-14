import { z } from "zod";
import { guard, json, jsonError } from "@/lib/api-util";
import { NOT_CONFIGURED, SessionId, eveFetch, opsConfig, upstreamError } from "../upstream";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({ sessionId: SessionId });

/** Asks eve to cancel the in-flight turn (the stream then reports turn.cancelled + session.waiting). */
export function POST(req: Request): Promise<Response> {
  return guard("POST /api/ops/cancel", async () => {
    if (!opsConfig()) return NOT_CONFIGURED();
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return jsonError("body must be { sessionId }", 400);
    const res = await eveFetch(`/session/${body.data.sessionId}/cancel`, { method: "POST", json: {} });
    if (!res.ok) return upstreamError(res);
    return json({ ok: true });
  });
}
