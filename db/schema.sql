-- Agent Factory schema (Neon Postgres). Idempotent: safe to re-run via `npm run db:migrate`.
create extension if not exists pgcrypto;

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  request text not null,
  status text not null default 'building', -- building | testing | ready | live | paused | broken | repairing | needs_human
  current_version int,
  schedule text not null,
  next_run_at timestamptz,
  requires_approval boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists agent_versions (
  agent_id uuid not null references agents(id) on delete cascade,
  version int not null,
  parent_version int,
  spec jsonb not null,                -- AgentSpec (src/lib/spec.ts), tests included
  reason text not null,               -- 'initial build' | 'user edit: …' | 'auto-repair: …' | 'feedback: …'
  created_by text not null,           -- 'user' | 'factory'
  status text not null default 'active', -- active | proposed | rejected
  created_at timestamptz not null default now(),
  primary key (agent_id, version)
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  version int not null,
  kind text not null,                 -- scheduled | manual | dry_run | repair_test
  status text not null default 'running', -- running | succeeded | failed | awaiting_approval | rejected
  output jsonb,                       -- RunOutput
  error text,
  cost_usd numeric not null default 0,
  model text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists step_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  idx int not null,
  step_id text not null,
  block text not null,
  status text not null,               -- ok | error | skipped
  input jsonb,
  output jsonb,
  error text,
  ms int
);

create table if not exists test_results (
  run_id uuid not null references runs(id) on delete cascade,
  test_index int not null,
  kind text not null,
  passed boolean not null,
  detail text,
  primary key (run_id, test_index)
);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  rating text not null,               -- useful | not_useful
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists agent_memory (
  agent_id uuid not null references agents(id) on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (agent_id, key)
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade,
  type text not null,
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists outbox (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade,
  run_id uuid references runs(id) on delete cascade,
  channel text not null default 'slack',
  body text not null,
  sent_ok boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists demo_state (
  key text primary key,
  value jsonb not null
);

create index if not exists agents_due_idx on agents (status, next_run_at);
create index if not exists runs_agent_idx on runs (agent_id, started_at desc);
create index if not exists events_created_idx on events (created_at desc);
create index if not exists step_runs_run_idx on step_runs (run_id, idx);

-- Connections (Slack, GitHub): encrypted credentials managed from /connections.
create table if not exists connections (
  provider text primary key,
  secret_enc text not null,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Custom connectors: HTTP API or remote MCP server, addable by anyone from /connections.
-- secret_enc is AES-GCM (src/lib/crypto.ts); it is never returned by any route.
create table if not exists custom_connectors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null,                 -- http | mcp
  name text not null,
  base_url text not null,
  auth_header text,
  secret_enc text,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by_ip text
);

-- Fleet knowledge graph (entities agents have posted about).
create table if not exists kg_entities (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,           -- lower-cased canonical name
  name text not null,
  kind text not null default 'topic', -- company | product | release | person | topic
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  mentions int not null default 0
);

create table if not exists kg_mentions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references kg_entities(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  run_id uuid,
  url text,
  snippet text,
  created_at timestamptz not null default now()
);

create index if not exists kg_mentions_entity_idx on kg_mentions (entity_id, created_at desc);
create index if not exists kg_mentions_agent_idx on kg_mentions (agent_id, created_at desc);
create index if not exists kg_entities_last_seen_idx on kg_entities (last_seen desc);

-- Per-agent Slack (bring your own webhook) + creator IP for the short post-create edit window.
alter table agents add column if not exists slack_webhook_enc text;
alter table agents add column if not exists created_by_ip text;
