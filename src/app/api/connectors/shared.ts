// Shared helpers for the custom connector routes (anyone can add; rate-limited, SSRF-guarded).
import type { NextRequest } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { CustomConnector } from "@/lib/repo-connectors";

export const OWNER_DELETE_WINDOW_MS = 30 * 60 * 1000;

export type PublicConnector = CustomConnector & { canDelete: boolean };

export function canDelete(request: NextRequest, c: { createdAt: string; createdByIp: string | null }): boolean {
  if (isAdminSession(request)) return true;
  const ip = clientIp(request);
  return !!c.createdByIp && ip !== "unknown" && c.createdByIp === ip && Date.now() - new Date(c.createdAt).getTime() < OWNER_DELETE_WINDOW_MS;
}

export function toPublic(request: NextRequest, c: CustomConnector & { createdByIp: string | null }): PublicConnector {
  const { createdByIp: _ip, ...rest } = c;
  void _ip;
  return { ...rest, canDelete: canDelete(request, c) };
}

/** Test calls hit third-party URLs on behalf of anonymous users: cap them. */
export function limitTests(request: NextRequest): Promise<Response | null> {
  return rateLimit("connector test", { key: clientIp(request), perKey: { max: 20, windowSec: 600 }, global: { max: 300, windowSec: 3600 } });
}

