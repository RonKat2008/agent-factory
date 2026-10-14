// GET /api/me → { user: { name, avatar, team } | null, slack: { channel, team } | null, slackOAuth: { configured } }
// No secrets. The Slack connection is the signed-in user's, else the anonymous visitor's.
import { guard, json } from "@/lib/api-util";
import { getVisitorSlack } from "@/lib/repo-visitor";
import { getSessionUser } from "@/lib/session";
import { isSlackOAuthConfigured } from "@/lib/slack-oauth";
import { getVisitorId } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
  return guard("GET /api/me", async () => {
    const user = await getSessionUser();
    const ownerId = user?.uid ?? (await getVisitorId());
    const slack = ownerId ? await getVisitorSlack(ownerId).catch(() => null) : null;
    return json({
      user: user ? { name: user.name, avatar: user.avatar, team: user.team } : null,
      slack: slack ? { channel: slack.channel, team: slack.team } : null,
      slackOAuth: { configured: isSlackOAuthConfigured() },
    });
  });
}
