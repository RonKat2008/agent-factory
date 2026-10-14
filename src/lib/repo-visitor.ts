// Visitor-owned data: per-visitor Slack connections (encrypted) + agent ownership.
// Parameterized SQL only. Decrypted webhooks never leave the server.
import { query } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

type Row = Record<string, unknown>;
const OWNER_GRACE_HOURS = 2;

/** Visitor connections are keyed by owner id: "slack:<team>:<user>" when signed in, else the anonymous af_uid. */
export interface VisitorSlack {
  connected: true;
  channel: string;
  team: string;
  configurationUrl: string | null;
  updatedAt: string;
}

export async function saveVisitorSlack(
  visitorId: string,
  webhook: string,
  meta: { channel: string; channelId: string | null; team: string; configurationUrl: string | null },
): Promise<void> {
  await query(
    `insert into visitor_connections (visitor_id, provider, secret_enc, meta, updated_at) values ($1, 'slack', $2, $3::jsonb, now())
     on conflict (visitor_id, provider) do update set secret_enc = excluded.secret_enc, meta = excluded.meta, updated_at = now()`,
    [visitorId, encryptSecret(webhook), JSON.stringify(meta)],
  );
}

export async function getVisitorSlack(visitorId: string): Promise<VisitorSlack | null> {
  const rows = await query<Row>(
    `select meta, updated_at from visitor_connections where visitor_id = $1 and provider = 'slack'`,
    [visitorId],
  );
  const r = rows[0];
  if (!r) return null;
  const meta = (r.meta ?? {}) as Record<string, unknown>;
  return {
    connected: true,
    channel: typeof meta.channel === "string" ? meta.channel : "channel",
    team: typeof meta.team === "string" ? meta.team : "Slack",
    configurationUrl: typeof meta.configurationUrl === "string" ? meta.configurationUrl : null,
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}

export async function deleteVisitorSlack(visitorId: string): Promise<void> {
  await query(`delete from visitor_connections where visitor_id = $1 and provider = 'slack'`, [visitorId]);
}

/** Webhook of the visitor who owns this agent, or null. Never throws (unmigrated DB, bad secret). */
export async function getOwnerSlackWebhook(agentId: string): Promise<string | null> {
  try {
    const rows = await query<Row>(
      `select vc.secret_enc from agents a
       join visitor_connections vc on vc.visitor_id = a.owner_visitor_id and vc.provider = 'slack'
       where a.id = $1`,
      [agentId],
    );
    const enc = rows[0]?.secret_enc;
    return typeof enc === "string" && enc ? decryptSecret(enc) : null;
  } catch (e) {
    console.error("[visitor] owner webhook lookup failed:", (e as Error).message);
    return null;
  }
}

export async function setAgentOwner(agentId: string, visitorId: string): Promise<void> {
  await query(`update agents set owner_visitor_id = $2 where id = $1 and owner_visitor_id is null`, [agentId, visitorId]);
}

/**
 * True when one of `ownerIds` owns the agent, or the agent is unowned, under 2h old and was created from the same IP
 * (claims it for ownerIds[0] in that case).
 */
export async function canEditAgent(agentId: string, ownerIds: string[], ip: string): Promise<boolean> {
  if (ownerIds.length === 0) return false;
  const rows = await query<Row>(
    `select owner_visitor_id, created_by_ip, created_at > now() - make_interval(hours => $2::int) as recent
     from agents where id = $1`,
    [agentId, OWNER_GRACE_HOURS],
  );
  const r = rows[0];
  if (!r) return false;
  if (typeof r.owner_visitor_id === "string" && ownerIds.includes(r.owner_visitor_id)) return true;
  if (r.owner_visitor_id == null && r.recent === true && r.created_by_ip === ip) {
    await setAgentOwner(agentId, ownerIds[0]);
    return true;
  }
  return false;
}

export async function upsertUser(u: { id: string; name: string; avatarUrl: string | null; teamName: string }): Promise<void> {
  await query(
    `insert into users (id, name, avatar_url, team_name) values ($1, $2, $3, $4)
     on conflict (id) do update set name = excluded.name, avatar_url = excluded.avatar_url, team_name = excluded.team_name`,
    [u.id, u.name, u.avatarUrl, u.teamName],
  );
}

/** On sign-in: agents created anonymously in this browser now belong to the user. */
export async function reownAgents(fromVisitorId: string, toUserId: string): Promise<void> {
  await query(`update agents set owner_visitor_id = $2 where owner_visitor_id = $1`, [fromVisitorId, toUserId]);
}

export async function listOwnedAgentIds(ownerIds: string[]): Promise<string[]> {
  if (ownerIds.length === 0) return [];
  const rows = await query<Row>(
    `select id from agents where owner_visitor_id = any($1::text[]) order by created_at desc limit 500`,
    [ownerIds],
  );
  return rows.map((r) => String(r.id));
}
