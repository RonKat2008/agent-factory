import type { NextRequest } from "next/server";
import { z } from "zod";
import { guard, json, jsonError } from "@/lib/api-util";
import { isAdminSession } from "@/lib/admin-auth";
import {
  REPO_RE, SLACK_WEBHOOK_RE, checkGithub, deleteConnection, getConnectionStatus, isProvider, saveConnection,
} from "@/lib/connections";

type Ctx = { params: Promise<{ provider: string }> };

const SlackBody = z.object({
  webhookUrl: z.string().trim().regex(SLACK_WEBHOOK_RE, "must look like https://hooks.slack.com/services/…"),
  channel: z.string().trim().max(80).optional(),
});
const GithubBody = z.object({
  token: z.string().trim().min(20, "token looks too short").max(400),
  repo: z.string().trim().regex(REPO_RE, 'repo must be "owner/name"'),
});

function firstIssue(e: z.ZodError): string {
  return e.issues[0]?.message ?? "invalid body";
}

/** Save (admin): slack { webhookUrl, channel? } | github { token, repo } (verified against GitHub first). */
export async function POST(request: NextRequest, { params }: Ctx) {
  return guard("connections.save", async () => {
    const { provider } = await params;
    if (!isProvider(provider)) return jsonError("unknown provider", 404);
    if (!isAdminSession(request)) return jsonError("unlock required", 401);
    const raw = await request.json().catch(() => null);

    if (provider === "slack") {
      const p = SlackBody.safeParse(raw);
      if (!p.success) return jsonError(firstIssue(p.error), 400);
      const channel = p.data.channel ? (p.data.channel.startsWith("#") ? p.data.channel : `#${p.data.channel}`) : null;
      await saveConnection("slack", p.data.webhookUrl, { channel, savedAt: new Date().toISOString() });
    } else {
      const p = GithubBody.safeParse(raw);
      if (!p.success) return jsonError(firstIssue(p.error), 400);
      const check = await checkGithub(p.data.token, p.data.repo);
      if (!check.ok) return jsonError(check.error ?? "GitHub check failed", 400);
      await saveConnection("github", p.data.token, {
        login: check.login, repo: check.repo, private: check.private, canPush: check.canPush, checkedAt: new Date().toISOString(),
      });
    }
    return json({ connection: await getConnectionStatus(provider) });
  });
}

/** Disconnect (admin). Env fallbacks, if set, still apply afterwards. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return guard("connections.delete", async () => {
    const { provider } = await params;
    if (!isProvider(provider)) return jsonError("unknown provider", 404);
    if (!isAdminSession(request)) return jsonError("unlock required", 401);
    await deleteConnection(provider);
    return json({ connection: await getConnectionStatus(provider) });
  });
}
