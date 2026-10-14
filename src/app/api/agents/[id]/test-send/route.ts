// "Send me a test now": posts the agent's latest preview message once to its channel (own Slack, else team/outbox).
import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { getAgent } from "@/lib/repo";
import { latestPreviewMessage } from "@/lib/repo-agent-settings";
import { deliverTest } from "@/lib/runtime/deliver";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const TEST_PREFIX = "🧪 Test from Agent Factory —";

export function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("POST /api/agents/:id/test-send", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const agent = await getAgent(id);
    if (!agent) return jsonError("not found", 404);
    const message = await latestPreviewMessage(id);
    if (!message) return jsonError("There's no message to send yet. Wait for the first test run to finish.", 409);
    const limited = await rateLimit("test-send", { key: id, perKey: { max: 3, windowSec: 600 }, global: { max: 60, windowSec: 3600 } });
    if (limited) return limited;
    const res = await deliverTest(id, `${TEST_PREFIX} ${agent.name}\n${message.trim()}`);
    if (!res.sent) return jsonError(res.error ?? "Slack didn't accept the message. Check the webhook URL.", 502);
    return json({ sent: true });
  });
}
