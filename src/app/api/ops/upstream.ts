// Server-only helpers for proxying to the eve Fleet Ops agent. The bearer key never leaves the server.
import { z } from "zod";
import { jsonError } from "@/lib/api-util";

export const SessionId = z.string().regex(/^wrun_[A-Za-z0-9]{10,64}$/);

export function opsConfig(): { url: string; key: string } | null {
  const url = process.env.OPS_URL?.replace(/\/+$/, "");
  const key = process.env.OPS_API_KEY;
  return url && key ? { url, key } : null;
}

export const NOT_CONFIGURED = () => jsonError("Fleet Ops is not configured on this deployment", 503);

/** Calls the eve agent. `path` is relative to /eve/v1. */
export async function eveFetch(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const cfg = opsConfig();
  if (!cfg) throw new Error("OPS_URL / OPS_API_KEY missing");
  const { json, ...rest } = init;
  return fetch(`${cfg.url}/eve/v1${path}`, {
    ...rest,
    headers: {
      authorization: `Bearer ${cfg.key}`,
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
}

/** Maps an upstream failure to a client-safe error (never forwards upstream bodies verbatim). */
export function upstreamError(res: Response): Response {
  return jsonError(res.status === 409 ? "Fleet Ops is still starting, try again" : `Fleet Ops responded ${res.status}`, res.status === 409 ? 409 : 502);
}
