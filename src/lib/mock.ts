// Mock data for building UI before the API is live (NEXT_PUBLIC_USE_MOCKS=true). Typed against the frozen contract.
import type { Agent, AgentDetail, AgentVersion, FeedEvent, OutboxMessage, Run, Stats } from "./types";
import type { AgentSpec } from "./spec";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const inMin = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

const ACME = "https://agent-factory.vercel.app/demo/acme";

export const agents: Agent[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Daily AI agents brief",
    request: "Every morning send me the top 3 AI agent stories from Hacker News and Simon Willison's blog, with links.",
    status: "live",
    currentVersion: 1,
    schedule: "*/30 * * * *",
    scheduleHuman: "Every 30 minutes",
    nextRunAt: inMin(12),
    lastRunAt: ago(18),
    requiresApproval: false,
    health: 100,
    runs: 7,
    successRate: 1,
    costUsd: 0.0142,
    usefulRate: 0.86,
    repairs: 0,
    plan: {
      runs: "Every 30 minutes",
      checks: "Hacker News (AI agents, 10+ points) and simonwillison.net",
      does: "Picks the 3 most important stories, one cited bullet each",
      sendsTo: "Slack #factory-demo",
      asksBefore: "Nothing",
    },
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Competitor watcher: Acme",
    request: "Watch Acme's changelog and tell me in Slack whenever they ship something.",
    status: "live",
    currentVersion: 2,
    schedule: "*/15 * * * *",
    scheduleHuman: "Every 15 minutes",
    nextRunAt: inMin(4),
    lastRunAt: ago(2),
    requiresApproval: false,
    health: 92,
    runs: 13,
    successRate: 0.92,
    costUsd: 0.0089,
    usefulRate: 1,
    repairs: 1,
    plan: {
      runs: "Every 15 minutes",
      checks: "acme.com changelog",
      does: "Diffs against last snapshot, summarizes new entries",
      sendsTo: "Slack #factory-demo",
      asksBefore: "Nothing",
    },
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Next.js release watcher",
    request: "Post new Next.js releases with the most notable change.",
    status: "repairing",
    currentVersion: 1,
    schedule: "0 * * * *",
    scheduleHuman: "Every hour",
    nextRunAt: inMin(41),
    lastRunAt: ago(19),
    requiresApproval: true,
    health: 75,
    runs: 4,
    successRate: 0.75,
    costUsd: 0.0031,
    usefulRate: null,
    repairs: 0,
    plan: {
      runs: "Every hour",
      checks: "github.com/vercel/next.js releases feed",
      does: "One bullet per new release with its headline change",
      sendsTo: "Slack #factory-demo",
      asksBefore: "Posting to Slack",
    },
  },
];

const watcherV1: AgentSpec = {
  name: "Competitor watcher: Acme",
  schedule: "*/15 * * * *",
  requiresApproval: false,
  plan: agents[1].plan!,
  steps: [
    { id: "page", block: "fetch_url", params: { url: `${ACME}/changelog` } },
    { id: "diff", block: "diff_with_memory", params: { input: "{{steps.page.text}}", memoryKey: "acme_changelog" } },
    {
      id: "summary",
      block: "llm",
      params: {
        instruction: "Summarize each new changelog entry in one bullet. Cite the Source URL.",
        input: "Source: {{steps.page.url}}\nNew entries:\n{{steps.diff.text}}",
        format: "cited_bullets",
      },
    },
    { id: "send", block: "send_slack", params: { message: "*Acme shipped something*\n{{steps.summary.markdown}}", skipIfEmpty: true } },
  ],
  tests: [
    { kind: "has_citations", addedBy: "build" },
    { kind: "no_post_if_unchanged", addedBy: "build" },
    { kind: "llm_judge", config: { rubric: "Only mentions changes present in the source; under 120 words." }, addedBy: "build" },
  ],
};

const watcherV2: AgentSpec = {
  ...watcherV1,
  steps: watcherV1.steps.map((s) =>
    s.block === "fetch_url" ? { ...s, params: { url: `${ACME}/updates` } } : s,
  ),
  tests: [
    ...watcherV1.tests,
    {
      kind: "step_succeeds",
      config: { stepId: "page" },
      addedBy: "repair",
      note: "Regression: changelog moved (404) on Oct 14 — source page must load with content.",
    },
  ],
};

const versions: AgentVersion[] = [
  {
    version: 2,
    parentVersion: 1,
    spec: watcherV2,
    reason: "auto-repair: /changelog returned 404; Acme's homepage now links 'What's new' → /demo/acme/updates. Switched the source URL and added a regression test.",
    createdBy: "factory",
    status: "active",
    createdAt: ago(3),
  },
  { version: 1, parentVersion: null, spec: watcherV1, reason: "initial build", createdBy: "user", status: "active", createdAt: ago(240) },
];

const okRun: Run = {
  id: "aaaaaaa1-0000-4000-8000-000000000001",
  agentId: agents[1].id,
  version: 2,
  kind: "repair_test",
  status: "succeeded",
  output: {
    message: `*Acme shipped something*\n• Acme launched SSO for all plans — <${ACME}/updates|source>`,
    citations: [{ text: "Acme launched SSO for all plans", url: `${ACME}/updates` }],
    posted: false,
    changed: true,
  },
  error: null,
  costUsd: 0.0007,
  startedAt: ago(3),
  finishedAt: ago(3),
  steps: [
    { idx: 0, stepId: "page", block: "fetch_url", status: "ok", ms: 182, input: { url: `${ACME}/updates` }, output: { status: 200, title: "What's new — Acme" }, error: null },
    { idx: 1, stepId: "diff", block: "diff_with_memory", status: "ok", ms: 21, input: {}, output: { changed: true, changes: ["SSO for all plans"] }, error: null },
    { idx: 2, stepId: "summary", block: "llm", status: "ok", ms: 1430, input: {}, output: { empty: false }, error: null },
    { idx: 3, stepId: "send", block: "send_slack", status: "ok", ms: 3, input: {}, output: { sent: false, skipped: false }, error: null },
  ],
  tests: [
    { testIndex: 0, kind: "has_citations", passed: true, detail: "1/1 bullets cited" },
    { testIndex: 1, kind: "no_post_if_unchanged", passed: true, detail: "n/a (content changed)" },
    { testIndex: 2, kind: "llm_judge", passed: true, detail: "Accurate, 14 words" },
    { testIndex: 3, kind: "step_succeeds", passed: true, detail: "page: 200, 2,431 chars" },
  ],
  feedback: null,
};

const brokenRun: Run = {
  id: "aaaaaaa1-0000-4000-8000-000000000002",
  agentId: agents[1].id,
  version: 1,
  kind: "manual",
  status: "failed",
  output: null,
  error: `HTTP 404 Not Found for ${ACME}/changelog`,
  costUsd: 0,
  startedAt: ago(4),
  finishedAt: ago(4),
  steps: [
    { idx: 0, stepId: "page", block: "fetch_url", status: "error", ms: 96, input: { url: `${ACME}/changelog` }, output: null, error: `HTTP 404 Not Found for ${ACME}/changelog` },
    { idx: 1, stepId: "diff", block: "diff_with_memory", status: "skipped", ms: null, input: null, output: null, error: null },
    { idx: 2, stepId: "summary", block: "llm", status: "skipped", ms: null, input: null, output: null, error: null },
    { idx: 3, stepId: "send", block: "send_slack", status: "skipped", ms: null, input: null, output: null, error: null },
  ],
  tests: [],
  feedback: null,
};

export function agentDetail(id: string): AgentDetail | null {
  const agent = agents.find((a) => a.id === id);
  if (!agent) return null;
  const isWatcher = id === agents[1].id;
  return {
    agent,
    versions: isWatcher ? versions : [{ ...versions[1], spec: { ...watcherV1, name: agent.name } }],
    runs: isWatcher ? [okRun, brokenRun] : [],
  };
}

let n = 0;
const ev = (min: number, agent: Agent | null, type: FeedEvent["type"], message: string): FeedEvent => ({
  id: `e${++n}`,
  agentId: agent?.id ?? null,
  agentName: agent?.name ?? null,
  type,
  message,
  data: null,
  createdAt: ago(min),
});

export const events: FeedEvent[] = [
  ev(1, agents[2], "repairing", "Feed returned malformed XML — diagnosing"),
  ev(2, agents[1], "repaired", "Fixed: changelog moved to /updates. Shipped v2 with +1 regression test."),
  ev(3, agents[1], "tests_passed", "v2 passed 4/4 tests on dry run"),
  ev(3, agents[1], "repairing", "Homepage links 'What's new' → /demo/acme/updates — trying it"),
  ev(4, agents[1], "broke", "fetch_url: HTTP 404 Not Found for /demo/acme/changelog"),
  ev(18, agents[0], "run_succeeded", "Posted 3 cited stories to Slack"),
  ev(31, agents[1], "run_succeeded", "Nothing new — skipped post"),
  ev(48, agents[0], "feedback", "👍 Useful"),
  ev(60, agents[2], "went_live", "Next.js release watcher is live"),
  ev(62, agents[2], "tests_passed", "2/2 tests passed"),
  ev(63, agents[2], "self_fixed", "Revised spec: cite the release URL in every bullet"),
  ev(63, agents[2], "test_failed", "has_citations: 2 of 3 bullets missing a URL"),
  ev(64, agents[2], "dry_run", "Dry run finished in 3.1s"),
  ev(65, agents[2], "built", "Generated spec: fetch_rss → diff → llm → send_slack"),
];

export const stats: Stats = { agentsLive: 2, runsToday: 24, autoRepairs: 1, totalCostUsd: 0.0262 };

export const outbox: OutboxMessage[] = [
  {
    id: "o1",
    agentId: agents[1].id,
    runId: okRun.id,
    body: "🔧 I fixed *Competitor watcher: Acme*: the changelog moved to /updates (old URL 404). Shipped v2 with a regression test.",
    sentOk: true,
    createdAt: ago(2),
  },
  {
    id: "o2",
    agentId: agents[0].id,
    runId: null,
    body: "*Daily AI agents brief*\n• OpenAI ships agent SDK v2 — <https://news.ycombinator.com|source>",
    sentOk: true,
    createdAt: ago(18),
  },
];
