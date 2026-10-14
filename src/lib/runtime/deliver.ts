// Delivery channel: Slack incoming webhook (when configured) + the outbox table (always).
import { outboxInsert } from "@/lib/repo";
import { getSlackWebhook } from "@/lib/connections";
import { getAgentWebhook } from "@/lib/repo-agent-settings";
import { getOwnerSlackWebhook } from "@/lib/repo-visitor";
import { extractAndStore } from "@/lib/knowledge";

const SLACK_TIMEOUT_MS = 8_000;

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function feedbackLine(runId: string): string {
  const base = `${appUrl()}/f/${runId}`;
  return `<${base}?r=useful|👍 Useful> · <${base}?r=not_useful|👎 Not useful>`;
}

async function postToSlack(text: string, agentId?: string | null): Promise<{ ok: boolean; error?: string } | null> {
  // Precedence: the agent's own webhook → its owner's "Sign in with Slack" channel → the team channel/env.
  const own = agentId ? ((await getAgentWebhook(agentId)) ?? (await getOwnerSlackWebhook(agentId))) : null;
  const webhook = own ?? (await getSlackWebhook());
  if (!webhook) return null;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, unfurl_links: false, unfurl_media: false }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    return res.ok ? { ok: true } : { ok: false, error: `Slack returned ${res.status}` };
  } catch (e) {
    return { ok: false, error: `Slack post failed: ${(e as Error).message}` };
  }
}

async function record(agentId: string | null, runId: string | null, body: string, sentOk: boolean): Promise<void> {
  try {
    await outboxInsert({ agentId, runId, body, sentOk });
  } catch (e) {
    console.error("[deliver] outbox insert failed:", e);
  }
}

/**
 * Sends an agent's message with feedback links. Never throws.
 * Without SLACK_WEBHOOK_URL the outbox IS the channel, so sent is true.
 */
export async function deliver(d: { agentId: string; runId: string; message: string }): Promise<{ sent: boolean; error?: string }> {
  const body = `${d.message.trim()}\n${feedbackLine(d.runId)}`;
  const slack = await postToSlack(body, d.agentId);
  const sent = slack === null ? true : slack.ok;
  if (slack && !slack.ok) console.error("[deliver]", slack.error);
  await record(d.agentId, d.runId, body, sent);
  if (sent) {
    try {
      // Awaited but bounded (~5s) and never throws: feeds the fleet knowledge graph.
      await extractAndStore({ agentId: d.agentId, runId: d.runId, message: d.message });
    } catch (e) {
      console.error("[deliver] knowledge extraction failed:", e);
    }
  }
  return { sent };
}

/** Factory notices (repair, needs-human). No feedback links. Never throws. */
export async function postFactoryMessage(text: string, agentId: string | null = null): Promise<{ sent: boolean }> {
  const slack = await postToSlack(text);
  const sent = slack === null ? true : slack.ok;
  await record(agentId, null, text, sent);
  return { sent };
}

/** One-off "send me a test" post to the agent's channel (own Slack, else team). No feedback links. Never throws. */
export async function deliverTest(agentId: string, text: string): Promise<{ sent: boolean; error?: string }> {
  const slack = await postToSlack(text, agentId);
  const sent = slack === null ? true : slack.ok;
  await record(agentId, null, text, sent);
  return { sent, error: slack && !slack.ok ? slack.error : undefined };
}
