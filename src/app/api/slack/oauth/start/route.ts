// GET /api/slack/oauth/start?agentId=<uuid?>&return=<path> → 302 to Slack's consent screen ("Sign in with Slack").
import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/api-util";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { authorizeUrl, isSlackOAuthConfigured, safeReturnPath, signState } from "@/lib/slack-oauth";
import { slackRedirect } from "@/lib/slack-redirect";
import { getOrCreateVisitorId } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const returnTo = safeReturnPath(params.get("return"));
  if (!isSlackOAuthConfigured()) return slackRedirect(req, returnTo, "error", "not_configured");
  try {
    const limited = await rateLimit("slack-oauth", { key: clientIp(req), perKey: { max: 10, windowSec: 600 }, global: { max: 300, windowSec: 3600 } });
    if (limited) return slackRedirect(req, returnTo, "error", "rate_limited");
    const rawAgent = params.get("agentId");
    const agentId = rawAgent && UUID_RE.test(rawAgent) ? rawAgent : null;
    const visitorId = await getOrCreateVisitorId();
    const state = signState({ visitorId, agentId, returnTo });
    return NextResponse.redirect(authorizeUrl(state, new URL(req.url).origin), 302);
  } catch (e) {
    console.error("[slack-oauth] start failed:", (e as Error).message);
    return slackRedirect(req, returnTo, "error", "start_failed");
  }
}
