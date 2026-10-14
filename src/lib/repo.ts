// Persistence layer: every SQL statement in the app lives here. Parameterized only.
import cronstrue from "cronstrue";
import { query } from "./db";
import type {
  Agent,
  AgentDetail,
  AgentSpec,
  AgentStatus,
  AgentVersion,
  EventType,
  FeedEvent,
  OutboxMessage,
  Run,
  RunKind,
  RunStatus,
  Stats,
  StepRun,
  TestResult,
} from "./types";
import type { RunOutput } from "./spec";

type Row = Record<string, unknown>;
type VersionStatus = "active" | "proposed" | "rejected";

const MAX_JSON_BYTES = 50_000;
const PREVIEW_CHARS = 2_000;
const NON_DRY = "('scheduled','manual','triggered')";

// ---------- helpers ----------

function iso(v: unknown): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
}
function isoReq(v: unknown): string {
  return iso(v) ?? new Date(0).toISOString();
}
function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}
function isoParam(d: string | Date): string {
  return d instanceof Date ? d.toISOString() : d;
}

/** Serialize for a jsonb param. Over 50KB -> `{truncated:true, preview}`. */
function jsonParam(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = JSON.stringify(v);
  if (s === undefined) return null;
  if (s.length > MAX_JSON_BYTES) {
    return JSON.stringify({ truncated: true, preview: s.slice(0, PREVIEW_CHARS) });
  }
  return s;
}

function humanCron(schedule: string): string {
  try {
    return cronstrue.toString(schedule);
  } catch {
    return schedule;
  }
}

// ---------- agents (read) ----------

const AGENT_SELECT = `
with finished as (
  select agent_id, status, started_at,
         row_number() over (partition by agent_id order by started_at desc) rn
  from runs
  where kind in ${NON_DRY} and status in ('succeeded','failed')
),
recent as (
  select agent_id,
         count(*) filter (where status = 'succeeded')::int as ok,
         count(*)::int as n
  from finished where rn <= 20 group by agent_id
),
run_stats as (
  select agent_id,
         count(*)::int as runs,
         count(*) filter (where status = 'succeeded')::int as ok,
         count(*) filter (where status in ('succeeded','failed'))::int as done,
         max(started_at) as last_run_at
  from runs where kind in ${NON_DRY} group by agent_id
),
costs as (select agent_id, sum(cost_usd) as cost from runs group by agent_id),
fb as (
  select agent_id,
         count(*) filter (where rating = 'useful')::int as useful,
         count(*)::int as total
  from feedback group by agent_id
),
rep as (
  select agent_id, count(*)::int as repairs
  from events
  where type = 'repaired' and agent_id is not null
  group by agent_id
)
select a.id, a.name, a.request, a.status, a.current_version, a.schedule, a.next_run_at,
       a.requires_approval, a.created_at,
       recent.ok as recent_ok, recent.n as recent_n,
       run_stats.runs, run_stats.ok as stat_ok, run_stats.done, run_stats.last_run_at,
       costs.cost, fb.useful, fb.total as fb_total, rep.repairs,
       v.spec -> 'plan' as plan
from agents a
left join recent on recent.agent_id = a.id
left join run_stats on run_stats.agent_id = a.id
left join costs on costs.agent_id = a.id
left join fb on fb.agent_id = a.id
left join rep on rep.agent_id = a.id
left join agent_versions v on v.agent_id = a.id and v.version = a.current_version
`;

function mapAgent(r: Row): Agent {
  const recentN = num(r.recent_n);
  const done = num(r.done);
  const fbTotal = num(r.fb_total);
  return {
    id: String(r.id),
    name: String(r.name),
    request: String(r.request),
    status: r.status as AgentStatus,
    currentVersion: r.current_version == null ? null : Number(r.current_version),
    schedule: String(r.schedule),
    scheduleHuman: humanCron(String(r.schedule)),
    nextRunAt: iso(r.next_run_at),
    lastRunAt: iso(r.last_run_at),
    requiresApproval: Boolean(r.requires_approval),
    health: recentN === 0 ? 100 : Math.round((100 * num(r.recent_ok)) / recentN),
    runs: num(r.runs),
    successRate: done === 0 ? 1 : num(r.stat_ok) / done,
    costUsd: num(r.cost),
    usefulRate: fbTotal === 0 ? null : num(r.useful) / fbTotal,
    repairs: num(r.repairs),
    plan: (r.plan as Agent["plan"]) ?? null,
  };
}

type RecentRun = NonNullable<Agent["recent"]>[number];

/** Last 20 non-dry runs (oldest→newest) and latest posted message per agent, in two set-based queries. */
async function loadAgentActivity(): Promise<{
  recent: Map<string, RecentRun[]>;
  last: Map<string, NonNullable<Agent["lastOutput"]>>;
}> {
  const [runRows, outRows] = await Promise.all([
    query<Row>(`
      select agent_id, status, kind, started_at, cost_usd,
             (extract(epoch from (finished_at - started_at)) * 1000)::int as ms
      from (
        select r.*, row_number() over (partition by agent_id order by started_at desc) rn
        from runs r where kind in ('scheduled','manual','triggered','repair_test')
      ) t where rn <= 20 order by agent_id, started_at asc`),
    query<Row>(`
      select distinct on (agent_id) agent_id, output ->> 'message' as message, started_at
      from runs
      where status = 'succeeded' and kind in ${NON_DRY} and output ->> 'posted' = 'true'
      order by agent_id, started_at desc`),
  ]);
  const recent = new Map<string, RecentRun[]>();
  for (const r of runRows) {
    const id = String(r.agent_id);
    const list = recent.get(id) ?? [];
    list.push({
      status: r.status as RunStatus,
      kind: r.kind as RunKind,
      startedAt: isoReq(r.started_at),
      costUsd: num(r.cost_usd),
      ms: r.ms == null ? null : Number(r.ms),
    });
    recent.set(id, list);
  }
  const last = new Map<string, NonNullable<Agent["lastOutput"]>>();
  for (const r of outRows) {
    if (r.message) last.set(String(r.agent_id), { message: String(r.message), at: isoReq(r.started_at) });
  }
  return { recent, last };
}

export async function listAgents(): Promise<Agent[]> {
  const [rows, activity] = await Promise.all([
    query<Row>(`${AGENT_SELECT} order by a.created_at asc`),
    loadAgentActivity(),
  ]);
  return rows.map((r) => {
    const id = String(r.id);
    return { ...mapAgent(r), recent: activity.recent.get(id) ?? [], lastOutput: activity.last.get(id) ?? null };
  });
}

export async function getAgent(id: string): Promise<Agent | null> {
  const rows = await query<Row>(`${AGENT_SELECT} where a.id = $1`, [id]);
  return rows[0] ? mapAgent(rows[0]) : null;
}

// ---------- runs (read) ----------

function mapStep(r: Row): StepRun {
  return {
    idx: num(r.idx),
    stepId: String(r.step_id),
    block: String(r.block),
    status: r.status as StepRun["status"],
    ms: r.ms == null ? null : Number(r.ms),
    input: r.input ?? null,
    output: r.output ?? null,
    error: (r.error as string | null) ?? null,
  };
}
function mapTest(r: Row): TestResult {
  return {
    testIndex: num(r.test_index),
    kind: String(r.kind),
    passed: Boolean(r.passed),
    detail: (r.detail as string | null) ?? null,
  };
}
function mapRun(r: Row): Run {
  return {
    id: String(r.id),
    agentId: String(r.agent_id),
    version: num(r.version),
    kind: r.kind as RunKind,
    status: r.status as RunStatus,
    output: (r.output as RunOutput | null) ?? null,
    error: (r.error as string | null) ?? null,
    costUsd: num(r.cost_usd),
    startedAt: isoReq(r.started_at),
    finishedAt: iso(r.finished_at),
  };
}
function mapVersion(r: Row): AgentVersion {
  return {
    version: num(r.version),
    parentVersion: r.parent_version == null ? null : Number(r.parent_version),
    spec: r.spec as AgentSpec,
    reason: String(r.reason),
    createdBy: r.created_by as AgentVersion["createdBy"],
    status: r.status as AgentVersion["status"],
    createdAt: isoReq(r.created_at),
  };
}

const RUN_COLS = `r.id, r.agent_id, r.version, r.kind, r.status, r.output, r.error, r.cost_usd, r.started_at, r.finished_at`;

/** Attach steps, tests, feedback to already-fetched run rows (3 queries total, any number of runs). */
async function hydrateRuns(rows: Row[]): Promise<Run[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.id));
  const [steps, tests, fbs] = await Promise.all([
    query<Row>(`select * from step_runs where run_id = any($1::uuid[]) order by run_id, idx`, [ids]),
    query<Row>(`select * from test_results where run_id = any($1::uuid[]) order by run_id, test_index`, [ids]),
    query<Row>(
      `select distinct on (run_id) run_id, rating from feedback
       where run_id = any($1::uuid[]) order by run_id, created_at desc`,
      [ids],
    ),
  ]);
  return rows.map((r) => {
    const id = String(r.id);
    return {
      ...mapRun(r),
      steps: steps.filter((s) => String(s.run_id) === id).map(mapStep),
      tests: tests.filter((t) => String(t.run_id) === id).map(mapTest),
      feedback: (fbs.find((f) => String(f.run_id) === id)?.rating as Run["feedback"]) ?? null,
    };
  });
}

export async function getRun(id: string): Promise<Run | null> {
  const rows = await query<Row>(`select ${RUN_COLS} from runs r where r.id = $1`, [id]);
  return (await hydrateRuns(rows))[0] ?? null;
}

export async function getAgentDetail(id: string): Promise<AgentDetail | null> {
  const agent = await getAgent(id);
  if (!agent) return null;
  const [versionRows, runRows] = await Promise.all([
    query<Row>(`select * from agent_versions where agent_id = $1 order by version desc`, [id]),
    query<Row>(`select ${RUN_COLS} from runs r where r.agent_id = $1 order by r.started_at desc limit 30`, [id]),
  ]);
  return { agent, versions: versionRows.map(mapVersion), runs: await hydrateRuns(runRows) };
}

export async function getActiveVersion(agentId: string): Promise<{ version: number; spec: AgentSpec } | null> {
  const rows = await query<Row>(
    `select v.version, v.spec from agents a
     join agent_versions v on v.agent_id = a.id and v.version = a.current_version
     where a.id = $1`,
    [agentId],
  );
  return rows[0] ? { version: num(rows[0].version), spec: rows[0].spec as AgentSpec } : null;
}

export async function getVersion(agentId: string, version: number): Promise<AgentVersion | null> {
  const rows = await query<Row>(`select * from agent_versions where agent_id = $1 and version = $2`, [agentId, version]);
  return rows[0] ? mapVersion(rows[0]) : null;
}

export async function getLastSuccessfulRun(agentId: string): Promise<Run | null> {
  const rows = await query<Row>(
    `select ${RUN_COLS} from runs r
     where r.agent_id = $1 and r.status = 'succeeded' and r.kind in ${NON_DRY}
     order by r.started_at desc limit 1`,
    [agentId],
  );
  return (await hydrateRuns(rows))[0] ?? null;
}

// ---------- feed / stats / outbox ----------

export async function listEvents(opts: { since?: string; agentId?: string; limit?: number } = {}): Promise<FeedEvent[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 50);
  const rows = await query<Row>(
    `select e.id, e.agent_id, a.name as agent_name, e.type, e.message, e.data, e.created_at
     from events e left join agents a on a.id = e.agent_id
     where ($1::timestamptz is null or e.created_at > $1::timestamptz)
       and ($2::uuid is null or e.agent_id = $2::uuid)
     order by e.created_at desc limit $3`,
    [opts.since ?? null, opts.agentId ?? null, limit],
  );
  return rows.map((r) => ({
    id: String(r.id),
    agentId: (r.agent_id as string | null) ?? null,
    agentName: (r.agent_name as string | null) ?? null,
    type: r.type as EventType,
    message: String(r.message),
    data: (r.data as Record<string, unknown> | null) ?? null,
    createdAt: isoReq(r.created_at),
  }));
}

export async function getStats(): Promise<Stats> {
  const rows = await query<Row>(
    `select
       (select count(*)::int from agents where status = 'live') as live,
       (select count(*)::int from runs where kind in ${NON_DRY}
          and started_at >= (date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')) as today,
       (select count(*)::int from events where type = 'repaired') as repairs,
       (select coalesce(sum(cost_usd), 0) from runs) as cost`,
  );
  const r = rows[0] ?? {};
  return {
    agentsLive: num(r.live),
    runsToday: num(r.today),
    autoRepairs: num(r.repairs),
    totalCostUsd: num(r.cost),
  };
}

export async function listOutbox(limit = 30): Promise<OutboxMessage[]> {
  const rows = await query<Row>(`select * from outbox order by created_at desc limit $1`, [limit]);
  return rows.map((r) => ({
    id: String(r.id),
    agentId: (r.agent_id as string | null) ?? null,
    runId: (r.run_id as string | null) ?? null,
    body: String(r.body),
    sentOk: Boolean(r.sent_ok),
    createdAt: isoReq(r.created_at),
  }));
}

// ---------- writes ----------

export async function createAgent(a: {
  name: string;
  request: string;
  schedule: string;
  status: AgentStatus;
  requiresApproval: boolean;
}): Promise<string> {
  const rows = await query<Row>(
    `insert into agents (name, request, schedule, status, requires_approval)
     values ($1, $2, $3, $4, $5) returning id`,
    [a.name, a.request, a.schedule, a.status, a.requiresApproval],
  );
  return String(rows[0].id);
}

export async function insertVersion(v: {
  agentId: string;
  spec: AgentSpec;
  reason: string;
  createdBy: "user" | "factory";
  parentVersion: number | null;
  status?: VersionStatus;
}): Promise<number> {
  const rows = await query<Row>(
    `insert into agent_versions (agent_id, version, parent_version, spec, reason, created_by, status)
     select $1::uuid, coalesce(max(version), 0) + 1, $2::int, $3::jsonb, $4, $5, $6
     from agent_versions where agent_id = $1::uuid
     returning version`,
    [v.agentId, v.parentVersion, JSON.stringify(v.spec), v.reason, v.createdBy, v.status ?? "active"],
  );
  return num(rows[0].version);
}

const AGENT_COLUMNS = {
  status: "status",
  currentVersion: "current_version",
  schedule: "schedule",
  nextRunAt: "next_run_at",
  requiresApproval: "requires_approval",
  name: "name",
} as const;

export async function updateAgent(
  id: string,
  patch: Partial<{
    status: AgentStatus;
    currentVersion: number | null;
    schedule: string;
    nextRunAt: string | Date | null;
    requiresApproval: boolean;
    name: string;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [key, col] of Object.entries(AGENT_COLUMNS)) {
    const val = (patch as Record<string, unknown>)[key];
    if (val === undefined) continue;
    params.push(val instanceof Date ? val.toISOString() : val);
    sets.push(`${col} = $${params.length}`);
  }
  if (sets.length === 0) return;
  await query(`update agents set ${sets.join(", ")} where id = $1`, params);
}

export async function setVersionStatus(agentId: string, version: number, status: VersionStatus): Promise<void> {
  await query(`update agent_versions set status = $3 where agent_id = $1 and version = $2`, [agentId, version, status]);
}

/** Demo reset: remove every version above `keepThrough` for one agent so the next insertVersion yields v2. */
export async function deleteVersionsAbove(agentId: string, keepThrough: number): Promise<void> {
  await query(`delete from agent_versions where agent_id = $1 and version > $2`, [agentId, keepThrough]);
}

export async function createRun(r: { agentId: string; version: number; kind: RunKind }): Promise<string> {
  const rows = await query<Row>(`insert into runs (agent_id, version, kind) values ($1, $2, $3) returning id`, [
    r.agentId,
    r.version,
    r.kind,
  ]);
  return String(rows[0].id);
}

export async function finishRun(
  runId: string,
  f: { status: RunStatus; output?: unknown; error?: string | null; costUsd?: number; model?: string | null },
): Promise<void> {
  await query(
    `update runs set status = $2, output = $3::jsonb, error = $4,
       cost_usd = case when $5::numeric is null then cost_usd else $5::numeric end,
       model = coalesce($6, model), finished_at = now()
     where id = $1`,
    [runId, f.status, jsonParam(f.output), f.error ?? null, f.costUsd ?? null, f.model ?? null],
  );
}

export async function addRunCost(runId: string, usd: number): Promise<void> {
  await query(`update runs set cost_usd = cost_usd + $2::numeric where id = $1`, [runId, usd]);
}

export async function insertStepRun(s: {
  runId: string;
  idx: number;
  stepId: string;
  block: string;
  status: "ok" | "error" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string | null;
  ms?: number | null;
}): Promise<void> {
  await query(
    `insert into step_runs (run_id, idx, step_id, block, status, input, output, error, ms)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      s.runId,
      s.idx,
      s.stepId,
      s.block,
      s.status,
      jsonParam(s.input),
      jsonParam(s.output),
      s.error ?? null,
      s.ms == null ? null : Math.round(s.ms),
    ],
  );
}

export async function insertTestResults(
  runId: string,
  results: { testIndex: number; kind: string; passed: boolean; detail?: string | null }[],
): Promise<void> {
  if (results.length === 0) return;
  const payload = results.map((r) => ({
    test_index: r.testIndex,
    kind: r.kind,
    passed: r.passed,
    detail: r.detail ?? null,
  }));
  await query(
    `insert into test_results (run_id, test_index, kind, passed, detail)
     select $1::uuid, t.test_index, t.kind, t.passed, t.detail
     from jsonb_to_recordset($2::jsonb) as t(test_index int, kind text, passed boolean, detail text)
     on conflict (run_id, test_index) do update
       set kind = excluded.kind, passed = excluded.passed, detail = excluded.detail`,
    [runId, JSON.stringify(payload)],
  );
}

export async function logEvent(
  agentId: string | null,
  type: EventType,
  message: string,
  data?: Record<string, unknown> | null,
): Promise<void> {
  await query(`insert into events (agent_id, type, message, data) values ($1, $2, $3, $4::jsonb)`, [
    agentId,
    type,
    message,
    jsonParam(data),
  ]);
}

export async function memoryGet(agentId: string, key: string): Promise<unknown> {
  const rows = await query<Row>(`select value from agent_memory where agent_id = $1 and key = $2`, [agentId, key]);
  return rows[0]?.value ?? null;
}

export async function memorySet(agentId: string, key: string, value: unknown): Promise<void> {
  await query(
    `insert into agent_memory (agent_id, key, value) values ($1, $2, $3::jsonb)
     on conflict (agent_id, key) do update set value = excluded.value, updated_at = now()`,
    [agentId, key, JSON.stringify(value ?? null)],
  );
}

export async function memoryClear(agentId: string): Promise<void> {
  await query(`delete from agent_memory where agent_id = $1`, [agentId]);
}

export async function outboxInsert(o: {
  agentId: string | null;
  runId: string | null;
  body: string;
  sentOk: boolean;
}): Promise<string> {
  const rows = await query<Row>(
    `insert into outbox (agent_id, run_id, body, sent_ok) values ($1, $2, $3, $4) returning id`,
    [o.agentId, o.runId, o.body, o.sentOk],
  );
  return String(rows[0].id);
}

/** Returns null when the run does not exist. */
export async function insertFeedback(f: {
  runId: string;
  rating: "useful" | "not_useful";
  comment?: string | null;
}): Promise<{ agentId: string } | null> {
  const rows = await query<Row>(
    `insert into feedback (run_id, agent_id, rating, comment)
     select r.id, r.agent_id, $2, $3 from runs r where r.id = $1
     returning agent_id`,
    [f.runId, f.rating, f.comment ?? null],
  );
  return rows[0] ? { agentId: String(rows[0].agent_id) } : null;
}

// ---------- scheduler ----------

/** Live agents whose next_run_at has passed. Hand each `nextRunAt` back to claimAgent as the expected value. */
export async function listDueAgentIds(now: Date | string): Promise<{ id: string; nextRunAt: string }[]> {
  const rows = await query<Row>(
    `select id, next_run_at from agents
     where status = 'live' and next_run_at is not null and next_run_at <= $1::timestamptz
     order by next_run_at asc`,
    [isoParam(now)],
  );
  return rows.map((r) => ({ id: String(r.id), nextRunAt: isoReq(r.next_run_at) }));
}

/** Optimistic claim: true only for the caller that advanced next_run_at. */
export async function claimAgent(
  id: string,
  expectedNextRunAt: string | Date,
  newNextRunAt: string | Date,
): Promise<boolean> {
  const rows = await query<Row>(
    `update agents set next_run_at = $3::timestamptz
     where id = $1 and date_trunc('milliseconds', next_run_at) = $2::timestamptz
     returning id`,
    [id, isoParam(expectedNextRunAt), isoParam(newNextRunAt)],
  );
  return rows.length > 0;
}

// ---------- demo state ----------

export async function demoGet(key: string): Promise<unknown> {
  const rows = await query<Row>(`select value from demo_state where key = $1`, [key]);
  return rows[0]?.value ?? null;
}

export async function demoSet(key: string, value: unknown): Promise<void> {
  await query(
    `insert into demo_state (key, value) values ($1, $2::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [key, JSON.stringify(value ?? null)],
  );
}

/** Attaches a comment to the latest comment-less feedback row of this rating for the run. Null when none. */
export async function attachFeedbackComment(f: {
  runId: string;
  rating: "useful" | "not_useful";
  comment: string;
}): Promise<{ agentId: string } | null> {
  const rows = await query<Row>(
    `update feedback set comment = $3
     where id = (select id from feedback where run_id = $1 and rating = $2 and comment is null
                 order by created_at desc limit 1)
     returning agent_id`,
    [f.runId, f.rating, f.comment],
  );
  return rows[0] ? { agentId: String(rows[0].agent_id) } : null;
}
