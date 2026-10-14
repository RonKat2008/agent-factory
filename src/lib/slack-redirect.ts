// Redirect helper for the Slack OAuth routes: back to a same-site path with ?slack=connected|error&reason=…
import { NextResponse } from "next/server";
import { appBaseUrl, safeReturnPath } from "./slack-oauth";

export function slackRedirect(req: Request, returnTo: string, outcome: "connected" | "error", reason?: string): NextResponse {
  const base = appBaseUrl(new URL(req.url).origin);
  const url = new URL(safeReturnPath(returnTo), `${base}/`);
  url.searchParams.set("slack", outcome);
  if (reason) url.searchParams.set("reason", reason.replace(/[^\w.-]/g, "").slice(0, 60));
  return NextResponse.redirect(url, 302);
}
