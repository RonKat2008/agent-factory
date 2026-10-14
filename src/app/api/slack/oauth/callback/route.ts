// GET /api/slack/oauth/callback?code&state — Slack's redirect after consent.
// Signs the visitor in (af_session), stores their channel webhook (encrypted), re-owns their anonymous agents,
// and claims the agent from the state when this visitor may edit it. Never logs or returns the webhook/token.
import { UUID_RE } from "@/lib/api-util";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { canEditAgent, reownAgents, saveVisitorSlack, upsertUser } from "@/lib/repo-visitor";
import { setSessionCookie, slackUserKey } from "@/lib/session";
import { exchangeCode, fetchSlackProfile, isSlackOAuthConfigured, verifyState } from "@/lib/slack-oauth";
import { slackRedirect } from "@/lib/slack-redirect";
import { getVisitorId } from "@/lib/visitor";

export const dynamic = "force-dynamic";

const FALLBACK_RETURN = "/connections";

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const state = verifyState(params.get("state"));
  const returnTo = state?.r ?? FALLBACK_RETURN;
  if (!isSlackOAuthConfigured()) return slackRedirect(req, returnTo, "error", "not_configured");
  if (!state) return slackRedirect(req, FALLBACK_RETURN, "error", "bad_state");
  if (params.get("error")) return slackRedirect(req, returnTo, "error", params.get("error") ?? "denied");
  const code = params.get("code");
  if (!code || code.length > 500) return slackRedirect(req, returnTo, "error", "missing_code");

  // The state is bound to the browser that started the flow (login-CSRF guard).
  const visitorId = await getVisitorId();
  if (!visitorId || visitorId !== state.v) return slackRedirect(req, returnTo, "error", "bad_state");

  try {
    const ip = clientIp(req);
    const limited = await rateLimit("slack-oauth-cb", { key: ip, perKey: { max: 10, windowSec: 600 }, global: { max: 300, windowSec: 3600 } });
    if (limited) return slackRedirect(req, returnTo, "error", "rate_limited");

    const origin = new URL(req.url).origin;
    const grant = await exchangeCode(code, origin);
    const profile = await fetchSlackProfile(grant.botToken, grant.slackUserId);
    const uid = slackUserKey(grant.teamId, grant.slackUserId);

    await upsertUser({ id: uid, name: profile.name, avatarUrl: profile.avatar, teamName: grant.teamName });
    await saveVisitorSlack(uid, grant.webhookUrl, {
      channel: grant.channel,
      channelId: grant.channelId,
      team: grant.teamName,
      configurationUrl: grant.configurationUrl,
    });
    await reownAgents(visitorId, uid);
    // The agent from the flow (if this browser may edit it) becomes the user's, so it posts to their channel via
    // the owner fallback in deliver.ts. No per-agent copy: "Change channel" later moves all their agents at once.
    if (state.a && UUID_RE.test(state.a)) await canEditAgent(state.a, [uid, visitorId], ip);
    await setSessionCookie({
      uid,
      slackUserId: grant.slackUserId,
      teamId: grant.teamId,
      team: grant.teamName,
      name: profile.name,
      avatar: profile.avatar,
    });
    return slackRedirect(req, returnTo, "connected");
  } catch (e) {
    const reason = (e as Error).message || "callback_failed";
    console.error("[slack-oauth] callback failed:", reason);
    return slackRedirect(req, returnTo, "error", reason);
  }
}
