// GET /api/me/connections → { slack: { connected, channel, team } | null, slackOAuth: { configured } }. No secrets.
import { guard, json } from "@/lib/api-util";
import { getVisitorSlack } from "@/lib/repo-visitor";
import { getSessionUser } from "@/lib/session";
import { isSlackOAuthConfigured } from "@/lib/slack-oauth";
import { getVisitorId } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
  return guard("GET /api/me/connections", async () => {
    const ownerId = (await getSessionUser())?.uid ?? (await getVisitorId());
    const slack = ownerId ? await getVisitorSlack(ownerId).catch(() => null) : null;
    return json({
      slack: slack ? { connected: true, channel: slack.channel, team: slack.team } : null,
      slackOAuth: { configured: isSlackOAuthConfigured() },
    });
  });
}
