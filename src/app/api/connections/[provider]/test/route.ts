import type { NextRequest } from "next/server";
import { guard, json, jsonError } from "@/lib/api-util";
import { isAdminSession } from "@/lib/admin-auth";
import {
  checkGithub, getConnectionStatus, getGithubDefaultRepo, getSecret, isProvider, sendSlackTest, updateConnectionMeta,
} from "@/lib/connections";

type Ctx = { params: Promise<{ provider: string }> };

/** Test the saved credential (admin). Slack posts "✅ Agent Factory connected"; GitHub checks /user + the default repo. */
export async function POST(request: NextRequest, { params }: Ctx) {
  return guard("connections.test", async () => {
    const { provider } = await params;
    if (!isProvider(provider)) return jsonError("unknown provider", 404);
    if (!isAdminSession(request)) return jsonError("unlock required", 401);
    const status = await getConnectionStatus(provider);
    const secret = await getSecret(provider);
    if (!secret) return jsonError(`${provider} is not connected`, 400);
    const testedAt = new Date().toISOString();

    if (provider === "slack") {
      const r = await sendSlackTest(secret);
      if (status.via === "connection") await updateConnectionMeta("slack", { lastTestAt: testedAt, lastTestOk: r.ok });
      if (!r.ok) return jsonError(r.error ?? "Slack test failed", 502);
      return json({ ok: true, connection: await getConnectionStatus(provider) });
    }

    const repo = await getGithubDefaultRepo();
    if (!repo) return jsonError("no default repo saved; reconnect GitHub with owner/name", 400);
    const r = await checkGithub(secret, repo);
    if (status.via === "connection") {
      await updateConnectionMeta("github", r.ok
        ? { login: r.login, repo: r.repo, private: r.private, canPush: r.canPush, checkedAt: testedAt, lastTestAt: testedAt, lastTestOk: true }
        : { lastTestAt: testedAt, lastTestOk: false });
    }
    if (!r.ok) return jsonError(r.error ?? "GitHub test failed", 502);
    return json({ ok: true, connection: await getConnectionStatus(provider) });
  });
}
