# Pitcrew

> Other tools help you build an agent. Pitcrew takes responsibility for keeping it running.
>
> Your AI agents get a pit crew.

**Why Pitcrew:** built at an event with an F1 team, so we leaned in. Your agents get a pit crew: built, tested, running, and fixed in seconds when they break.

Describe a recurring job in one sentence. Pitcrew builds the agent, writes its tests, ships it only if the tests pass, runs it on a schedule, and repairs it when it breaks. Agents are JSON specs assembled from a fixed block library, so every build, edit, and repair is a versioned, testable diff rather than generated code. Agents can trigger other agents, and every post feeds a fleet knowledge graph that later agents can recall.

Built for the Vercel Fast Forward hackathon, Agents & Factories track.

## Live links

| What | URL |
|---|---|
| App | https://pitcrew-ai.vercel.app |
| Judge Tour (public, no sign-in) | https://pitcrew-ai.vercel.app/tour |
| Fleet Ops agent (eve) | https://agent-factory-ops.vercel.app (health: `/eve/v1/health`) |

## 2-minute judge tour

No account needed. Open the app, then:

1. **Tour -> Break.** Open `/tour` and click Break. The fake competitor site (Acme) "redesigns" and its changelog URL starts returning 404. Run the Competitor watcher and watch Pitcrew repair itself in about 8 seconds: diagnose, patch, re-test, new version. Open the diff: the URL changed and one regression test was added.
2. **Publish.** Click Publish on the Tour. The watcher now sees a new Acme release and posts; that post fires the chained Competitor deep-dive agent, which researches the release with Exa and posts its own analysis. Check the Outbox if Slack is not connected.
3. **Graph.** Open Graph. The Flow view shows the watcher feeding the deep-dive; the Knowledge view shows the entities extracted from every post.
4. **Team radio (Ask Ops).** Press Cmd+K (Ctrl+K on Windows) and ask "why did the watcher break?". The eve Fleet Ops agent answers from run history. Anything that changes the fleet (pause, edit, re-run) asks for your approval first.
5. **Build your own.** Go to the home page, type a job in one sentence, review the plan and the Slack preview, click "Send me a test now", and go live. Sign in with Slack to have posts go to your own channel.

## How it works

```
 "Every weekday, tell #product what our competitors shipped"
        |
        v
 +---------+   +---------+   +---------+   +----------+   +---------+
 | request |-->|  spec   |-->| dry run |-->|  tests   |-->|  live   |
 | English |   | (JSON   |   | (real   |   | (6 kinds)|   | (cron)  |
 +---------+   |  blocks)|   |  blocks)|   +----+-----+   +----+----+
               +----^----+   +---------+        | fail         |
                    |                           v              v
                    +------ revise (<=3) --- self-fix     runAgent step
                                                          (durable workflow)
                                                               |
              +------------------------+----------------------+
              | step fails             | tests pass           | post lands
              v                        v                      v
      +---------------+      +-----------------+     +------------------+
      | repairAgent   |      | deliver: Slack  |     | knowledge: extract|
      | diagnose,     |      | (or hold if the |     | entities from the |
      | patch, re-test|      |  judge test     |     | post -> graph;    |
      | + regression  |      |  failed)        |     | `recall` block    |
      | test, v+1     |      +--------+--------+     | reads it later    |
      +---------------+               |              +------------------+
                                      v
                          +------------------------+
                          | chain: event trigger   |
                          | fires downstream agent |
                          | (watcher -> deep-dive) |
                          +------------------------+
```

Failures (a 404, a bad link, a thumbs-down) become either a repair with a regression test or a proposed edit. Nothing replaces an active version until its tests pass.

## Features

**Build**
- Beginner home and a 3-step create flow: describe, review the plan card with a Slack preview, go live. "Send me a test now" posts a real sample, and the schedule is editable in plain terms.
- Builder turns English into a Zod-validated JSON spec, dry-runs it against real sources, and revises up to 3 times from failed tests.
- Export as eve agent: download a proven agent as a standalone eve project.

**Run**
- Vercel Cron ticks every minute and claims due agents; each run is a durable Workflow DevKit workflow with every step's input and output recorded.
- Test-gated delivery: a run posts only after its tests pass. If only the LLM-judge test fails, the post is held rather than sent.
- Agent chains: an agent can trigger another when it posts. The Acme watcher triggers the Competitor deep-dive, which researches with Exa.
- Cost is tracked per run, about $0.0003 per run on Haiku 5.5.

**Repair**
- Self-repair in about 8 seconds: diagnose from the error, the failing step's I/O, the last good output, and verified link candidates; patch; re-run old and new tests; promote a new version.
- Every failure becomes a test: repair adds a `step_succeeds` regression test for the exact break.
- Public judge Tour with Break, Publish, and Reset controls.

**Steer**
- English edits ("only posts with 100+ points") produce a new version, re-tested before it replaces the old one.
- `require_approval` pauses a run until a human approves or rejects.
- A thumbs-down on a Slack post becomes a proposed fix to the agent.
- Team radio (Cmd+K): chat with the eve Fleet Ops agent; mutating actions need approval.

**Connect**
- Sign in with Slack: any visitor can connect their workspace, and their agents post to their own channel.
- Custom connectors anyone can add, over an HTTP API or MCP. Exa, Kernel, Context7, and DeepWiki are connected. A "Build a connector" guide walks through it.
- GitHub connection for the `github_issues` block.
- Vercel Sandbox `run_code` block for sandboxed code steps.

**Observe**
- My agents: health, last output, run strip, sparklines, live activity feed, repairs counted from events.
- Graph page: Flow view (chains, connectors) and Knowledge view (entities across posts).
- Fleet knowledge graph: entities are extracted from every post; the `recall` block lets an agent read them.
- Outbox for every message, delivered or not. Vercel Web Analytics and Speed Insights on the app.

### Blocks

An agent spec (`src/lib/spec.ts`) is a schedule, ordered steps, tests, and a plan card. Steps reference earlier outputs with templates such as `{{steps.page.text}}`. Blocks never throw; they return `{ ok, output | error }`, which is what makes repair possible.

| Block | What it does |
|---|---|
| `fetch_url` | Fetch a page, return readable text and links. Fails on non-2xx. |
| `fetch_rss` | Read an RSS, Atom, or GitHub releases feed. |
| `hn_search` | Search Hacker News stories via Algolia. |
| `github_issues` | List open issues, or apply labels and comments. |
| `llm` | Summarize or classify; cited bullets may only use URLs in the input. |
| `filter` | Keep items where a field passes `gt`, `gte`, `lt`, `lte`, `eq`, or `contains`. |
| `diff_with_memory` | Compare input to what the agent saw last run, remember the new state. |
| `recall` | Read entities from the fleet knowledge graph. |
| `connector` | Call a custom connector (HTTP API or MCP tool). |
| `run_code` | Run code in a Vercel Sandbox microVM. |
| `send_slack` | Post to Slack with useful / not useful links; optional `skipIfEmpty`. |
| `require_approval` | Pause the run until a human approves or rejects. |

### Test kinds

`nonempty`, `has_citations`, `max_items`, `llm_judge`, `no_post_if_unchanged`, `step_succeeds` (written by repair as the regression test).

## Built with Vercel

| Product | What it does here |
|---|---|
| Hosting | Serves the Next.js 16 app and APIs. |
| Fluid compute | Runs the long AI and workflow requests (build, repair, Team radio stream). |
| Cron | Per-minute tick that claims due agents. |
| Workflow DevKit | Durable, retryable `runAgent`, `buildAgent`, and `repairAgent`. |
| AI SDK | Structured generation and tool use for build, revise, repair, edit, and `llm` blocks. |
| AI Gateway | Model routing: Sonnet 5.5 builds and repairs, Haiku 5.5 runs steps and judges. |
| Sandbox | Isolated Firecracker microVM for the `run_code` block. |
| eve | The Fleet Ops agent (its own Vercel project) and the Export as eve agent feature. |
| BotID | Blocks bots on public AI routes and feedback links. |
| Web Analytics, Speed Insights | Traffic and Core Web Vitals. |

Also: Neon Postgres. Local dev uses a `dev` Neon branch; production uses a separate database on the main branch.

## Architecture notes

- **Specs, not code.** An agent is JSON over a fixed block library. A repair or edit is a diff between two versions, which can be tested, shown, and rolled back.
- **One runtime.** Dry runs, scheduled runs, Tour runs, and tests all go through the same block runner.
- **Durable steps.** Each workflow step is retried by Workflow DevKit; step I/O is persisted in Neon, which is the evidence repair works from.
- **Test-gated delivery.** Build, edit, repair, and every post pass through the agent's tests first. Judge-only failures hold the post.
- **Chains are data.** An event trigger row says "when agent A posts, run agent B with A's output". Chains are visible on the Graph page.
- **Raw SQL.** `@neondatabase/serverless`, no ORM; schema in `db/schema.sql`.

## Setup

Prerequisites: Node 20+, a Vercel account.

```bash
git clone https://github.com/RonKat2008/agent-factory && cd agent-factory
npm i
vercel link
vercel env pull .env.local
npm run db:migrate
npm run dev                  # http://localhost:3000
npm run db:seed              # second terminal: the 3 demo agents
```

Then, with the app running (replace `$APP_URL` and use your `ADMIN_KEY`):

```bash
# add the chained Competitor deep-dive (idempotent)
curl -X POST "$APP_URL/api/demo/seed-chain?key=$ADMIN_KEY"
# extract entities from the last 40 posts so the Knowledge graph is not empty
curl -X POST "$APP_URL/api/knowledge/backfill?key=$ADMIN_KEY"
```

`vercel env pull` supplies `DATABASE_URL` and a `VERCEL_OIDC_TOKEN` for AI Gateway locally. `DEMO_MODE=true` serves canned AI replies with no gateway access.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string. |
| `AI_GATEWAY_API_KEY` | AI Gateway key; optional locally with the OIDC token. |
| `MODEL_SMART` / `MODEL_FAST` | Gateway models. Defaults `anthropic/claude-sonnet-5.5` and `anthropic/claude-haiku-5.5`. |
| `CRON_SECRET` | Bearer secret Vercel Cron sends to `/api/cron/tick`. |
| `ADMIN_KEY` | Guards admin and demo endpoints (`?key=`) and the admin session. |
| `APP_URL` | Public base URL, used in Slack feedback links. |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | Slack app credentials for Sign in with Slack. |
| `SLACK_STATE_SECRET` | Signs the OAuth state. |
| `SLACK_WEBHOOK_URL` | Fallback incoming webhook for the demo fleet. |
| `GITHUB_TOKEN` | Fallback token for `github_issues`. |
| `CONNECTIONS_KEY` | Encryption key for stored credentials. |
| `OPS_URL`, `OPS_API_KEY` | Where the app reaches the Fleet Ops agent, and the bearer key it uses. |
| `DEMO_MODE` | `true` serves canned AI replies from `src/lib/demo.ts`. |

The Fleet Ops agent lives in `ops-agent/` and deploys as its own Vercel project (see `ops-agent/README.md`). Other scripts: `npm run verify` (typecheck, lint, build), `npm run preflight`.

## Security notes

- Connection credentials (Slack tokens, GitHub tokens, connector keys) are stored encrypted.
- BotID protects public AI routes and feedback links; public AI routes are also rate limited, with per-key and global windows backed by Postgres.
- Schedules have a minimum interval and each visitor has a live-agent cap.
- Admin and demo routes need `ADMIN_KEY`; connection management needs an admin session.
- The GitHub token is scoped to the connected repo. Outbound fetches go through a guarded network helper.
- Team radio cannot change the fleet without an explicit approval.

## Docs

[`docs/DEMO.md`](docs/DEMO.md) (3-minute script), [`docs/PITCH.md`](docs/PITCH.md) (Devpost text), [`docs/STATUS.md`](docs/STATUS.md), [`docs/TEAMMATE.md`](docs/TEAMMATE.md), [`docs/SPEC.md`](docs/SPEC.md), [`docs/API.md`](docs/API.md).

## Team

TBD (names and roles to be added before submission).
