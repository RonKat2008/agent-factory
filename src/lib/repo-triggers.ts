// Agent chains: triggers are derived from each agent's ACTIVE spec (`spec.trigger`). Parameterized SQL only.
import { query } from "./db";
import type { TriggerContext } from "./runtime/template";
import type { AgentStatus } from "./types";

type Row = Record<string, unknown>;

/** Max hops in one chain (A posts -> B -> C -> D). The 4th hop is skipped with a chain_skipped event. */
export const MAX_CHAIN_DEPTH = 3;

export type TriggerEdge = { fromAgentId: string; toAgentId: string; when: "posted" };

/** Every trigger edge in the fleet (upstream -> downstream), from active specs. */
export async function listTriggers(): Promise<TriggerEdge[]> {
  const rows = await query<Row>(
    `select a.id as to_id, v.spec -> 'trigger' ->> 'agentId' as from_id
     from agents a
     join agent_versions v on v.agent_id = a.id and v.version = a.current_version
     where v.spec -> 'trigger' ->> 'agentId' is not null
     order by a.created_at asc`,
  );
  return rows.map((r) => ({ fromAgentId: String(r.from_id), toAgentId: String(r.to_id), when: "posted" as const }));
}

/** Agents whose active spec is triggered by `upstreamId` (any status; the caller applies the guards). */
export async function listDownstream(upstreamId: string): Promise<{ id: string; name: string; status: AgentStatus }[]> {
  const rows = await query<Row>(
    `select a.id, a.name, a.status
     from agents a
     join agent_versions v on v.agent_id = a.id and v.version = a.current_version
     where v.spec -> 'trigger' ->> 'agentId' = $1
     order by a.created_at asc`,
    [upstreamId],
  );
  return rows.map((r) => ({ id: String(r.id), name: String(r.name), status: r.status as AgentStatus }));
}

/** Compact directory of agents for the builder prompt (id, name, what it posts). */
export async function agentDirectory(excludeId?: string): Promise<{ id: string; name: string; does: string; status: AgentStatus }[]> {
  const rows = await query<Row>(
    `select a.id, a.name, a.status, v.spec -> 'plan' ->> 'does' as does
     from agents a
     left join agent_versions v on v.agent_id = a.id and v.version = a.current_version
     where ($1::uuid is null or a.id <> $1::uuid) and a.status not in ('building')
     order by a.created_at asc
     limit 40`,
    [excludeId ?? null],
  );
  return rows.map((r) => ({ id: String(r.id), name: String(r.name), does: String(r.does ?? ""), status: r.status as AgentStatus }));
}

/** Upstream id of an agent's active trigger, or null. */
async function upstreamOf(agentId: string): Promise<string | null> {
  const rows = await query<Row>(
    `select v.spec -> 'trigger' ->> 'agentId' as up
     from agents a join agent_versions v on v.agent_id = a.id and v.version = a.current_version
     where a.id = $1`,
    [agentId],
  );
  return (rows[0]?.up as string | null) ?? null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Why `selfId` may not be triggered by `upstreamId` (null when fine): self-trigger, unknown agent,
 * or a cycle (the upstream is itself, transitively, triggered by selfId).
 */
export async function triggerProblem(selfId: string | null, upstreamId: string): Promise<string | null> {
  if (selfId && upstreamId === selfId) return "an agent cannot trigger itself";
  if (!UUID_RE.test(upstreamId)) return `trigger.agentId "${upstreamId}" is not an agent id`;
  const exists = await query<Row>(`select 1 from agents where id = $1`, [upstreamId]);
  if (exists.length === 0) return `trigger.agentId "${upstreamId}" does not exist`;
  if (!selfId) return null;
  let cur: string | null = upstreamId;
  for (let hop = 0; hop < 10 && cur; hop++) {
    cur = await upstreamOf(cur);
    if (cur === selfId) return "this trigger would create a loop between agents";
  }
  return null;
}

/**
 * Sample trigger context: the upstream's latest message (prefer a real post, else the latest run that
 * produced a message, e.g. a dry run). Used for dry runs and non-triggered runs of a chained agent.
 */
export async function sampleTriggerContext(upstreamId: string): Promise<TriggerContext> {
  const rows = await query<Row>(
    `select a.name, r.id as run_id, r.output
     from agents a
     left join lateral (
       select id, output from runs
       where agent_id = a.id and coalesce(output ->> 'message', '') <> ''
       order by (output ->> 'posted' = 'true') desc, started_at desc
       limit 1
     ) r on true
     where a.id = $1`,
    [upstreamId],
  );
  const r = rows[0];
  const name = r ? String(r.name) : "Upstream agent";
  const out = (r?.output ?? null) as { message?: unknown; citations?: unknown } | null;
  const message = typeof out?.message === "string" && out.message.trim() ? out.message : `(${name} has not posted anything yet)`;
  const citations = Array.isArray(out?.citations) ? (out.citations as { text: string; url: string }[]) : [];
  return { agentId: upstreamId, agentName: name, runId: (r?.run_id as string | null) ?? null, message, citations, depth: 0, sample: true };
}
