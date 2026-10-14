import { guard, jsonError } from "@/lib/api-util";
import { NOT_CONFIGURED, SessionId, eveFetch, opsConfig, upstreamError } from "../upstream";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Passthrough of the session's NDJSON event stream. It replays from event 0; the client skips events it has seen. */
export function GET(req: Request): Promise<Response> {
  return guard("GET /api/ops/stream", async () => {
    if (!opsConfig()) return NOT_CONFIGURED();
    const id = SessionId.safeParse(new URL(req.url).searchParams.get("sessionId"));
    if (!id.success) return jsonError("sessionId required", 400);
    const res = await eveFetch(`/session/${id.data}/stream`, { signal: req.signal });
    if (!res.ok || !res.body) return upstreamError(res);
    return new Response(res.body, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" },
    });
  });
}
