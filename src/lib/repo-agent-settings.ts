// Per-agent settings: bring-your-own Slack webhook (encrypted) + creator IP for the post-create edit window.
// Parameterized SQL only. The decrypted webhook never leaves the server.
import { query } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

type Row = Record<string, unknown>;

export type AgentOwnership = { createdAt: string; createdByIp: string | null; hasOwnSlack: boolean };

export async function setCreatedByIp(agentId: string, ip: string): Promise<void> {
  await query(`update agents set created_by_ip = $2 where id = $1`, [agentId, ip.slice(0, 64)]);
}

export async function getAgentOwnership(agentId: string): Promise<AgentOwnership | null> {
  const rows = await query<Row>(
    `select created_at, created_by_ip, slack_webhook_enc is not null as has_slack from agents where id = $1`,
    [agentId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    createdAt: new Date(String(r.created_at)).toISOString(),
    createdByIp: r.created_by_ip == null ? null : String(r.created_by_ip),
    hasOwnSlack: Boolean(r.has_slack),
  };
}

/** Stores (encrypted) or clears the agent's own Slack incoming webhook. */
export async function setAgentWebhook(agentId: string, webhook: string | null): Promise<void> {
  await query(`update agents set slack_webhook_enc = $2 where id = $1`, [agentId, webhook ? encryptSecret(webhook) : null]);
}

/** The agent's own webhook, or null (none set, unmigrated DB, or undecryptable). Never throws. */
export async function getAgentWebhook(agentId: string): Promise<string | null> {
  try {
    const rows = await query<Row>(`select slack_webhook_enc from agents where id = $1`, [agentId]);
    const enc = rows[0]?.slack_webhook_enc;
    return typeof enc === "string" && enc ? decryptSecret(enc) : null;
  } catch (e) {
    console.error("[agent-settings] webhook lookup failed:", (e as Error).message);
    return null;
  }
}

/** Message of the agent's most recent run that produced one (dry runs included). */
export async function latestPreviewMessage(agentId: string): Promise<string | null> {
  const rows = await query<Row>(
    `select output->>'message' as message from runs
     where agent_id = $1 and coalesce(output->>'message', '') <> ''
     order by (kind = 'dry_run') desc, started_at desc limit 1`,
    [agentId],
  );
  const m = rows[0]?.message;
  return typeof m === "string" && m.trim() ? m : null;
}
