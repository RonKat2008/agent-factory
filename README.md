# Agent Factory

> Other tools help you build an agent. Ours takes responsibility for keeping it working.

**Live demo: TBD**

Describe a recurring job in one sentence and Agent Factory builds the agent, writes its tests, ships it only if the tests pass, runs it on a schedule, and repairs it when it breaks. Agents are JSON specs assembled from a fixed block library, so every build, edit, and repair is a versioned, testable diff rather than generated code. The failure that triggered a repair becomes a permanent regression test, and thumbs-down feedback on a Slack post becomes a proposed edit to the agent.

Built for the Vercel Fast Forward hackathon, Agents & Factories track.

## How it works

```
 "Every weekday, tell #product what our competitors shipped"
        |
        v
 +-----------+   +---------+   +---------+   +-----------+   +--------+
 |  request  |-->|  spec   |-->| dry run |-->|   tests   |-->|  live  |
 | (English) |   | (JSON   |   | (real   |   | (6 kinds) |   | (cron) |
 +-----------+   |  blocks)|   |  blocks)|   +-----+-----+   +----+---+
                 +----^----+   +---------+         | fail         |
                      |                            v              v
                      |                     +-----------+   +-----------+
                      +---- revise (<=3) ---|  self-fix |   | cron run  |
                                            +-----------+   | every min |
                                                            +----+------+
                                                                 | step fails
                                                                 v
   +-----------+   +---------+   +----------+   +--------------+
   | new       |<--| re-test |<--|  patch   |<--|  diagnose    |
   | version + |   | (old +  |   |  spec    |   |  (error, I/O,|
   | regression|   |  new    |   |          |   |  link        |
   | test      |   |  tests) |   +----------+   |  candidates) |
   +-----+-----+   +---------+                  +--------------+
         |
         v
   Slack: "I fixed X because Y, and added a regression test. [diff]"
```

### Block library

An agent spec (`src/lib/spec.ts`) is a schedule, an ordered list of steps, a list of tests, and a plan card. Steps reference earlier outputs with templates such as `{{steps.page.text}}`. Blocks never throw; they return `{ ok, output | error }`, which is what makes repair possible.

| Block | What it does |
|---|---|
| `fetch_url` | Fetch a page and return readable text plus links. Fails on any non-2xx status. |
| `fetch_rss` | Read an RSS, Atom, or GitHub releases feed. |
| `hn_search` | Search Hacker News stories via Algolia, with `minPoints` and `sinceHours`. |
| `github_issues` | List open issues, or apply labels and comments. |
| `llm` | Fast model summarizes or classifies: `text`, `cited_bullets`, or `issue_labels`. Cited bullets may only use URLs present in the input. |
| `filter` | Keep array items where a field passes `gt`, `gte`, `lt`, `lte`, `eq`, or `contains`. |
| `diff_with_memory` | Compare input to what the agent saw last run and remember the new state. |
| `send_slack` | Post to Slack with useful / not useful feedback links; optional `skipIfEmpty`. |
| `require_approval` | Pause the run until a human approves or rejects the message. |

### Test kinds

| Kind | Passes when |
|---|---|
| `nonempty` | The final message is non-empty (unless nothing changed). |
| `has_citations` | Every bullet in the final message has a URL. |
| `max_items` | The message has at most `config.max` bullets. |
| `llm_judge` | A fast model judges the final message against `config.rubric`. |
| `no_post_if_unchanged` | When the diff reports no change, nothing is posted. |
| `step_succeeds` | `config.stepId` returns ok with non-empty output. Repair writes these as regression tests. |

### Workflows

All three run on Vercel Workflow DevKit, so each step is durable and retryable.

| Workflow | Trigger | What it does |
|---|---|---|
| `runAgent` | Vercel Cron tick (every minute claims due agents), Run now, or `POST /api/agents/:id/run` | Executes the active version step by step, records every step's input and output, runs tests, posts to Slack (or holds for approval), tracks cost. On a failed step it hands off to `repairAgent`. |
| `buildAgent` | `POST /api/agents` | Request to spec, dry run, tests, and up to 3 revise loops that feed failed tests and step outputs back to the model. The agent reaches `ready` only when tests pass. |
| `repairAgent` | A failed scheduled run | Diagnoses from the error, the failing step's I/O, the last good output, and verified link candidates. Patches the spec, re-runs old and new tests, and promotes a new version with a `step_succeeds` regression test only if everything passes. Otherwise the agent goes to `needs_human`. |

## What makes it different

- **Test-gated deploys.** No agent goes live, and no edit or repair becomes active, until its tests pass against a real dry run.
- **Self-repair.** When a source changes under an agent, the factory diagnoses, patches, re-tests, and ships a new version while you are away, then tells you in Slack with a diff.
- **Every failure becomes a regression test.** A repair adds a test for the exact failure it fixed, so the same break cannot ship twice.
- **Feedback edits the agent.** A thumbs-down on a Slack post, or an English instruction such as "only posts with 100+ points", produces a new proposed version that is re-tested before it replaces the old one.

## Built with

- Next.js 16 and React 19
- Vercel Workflow DevKit for durable `runAgent`, `buildAgent`, and `repairAgent`
- Vercel Cron for the per-minute scheduler tick
- AI SDK with Vercel AI Gateway: Claude Sonnet 5.5 builds, revises, and repairs; Claude Haiku 5.5 runs `llm` steps and `llm_judge` tests
- Neon Postgres via `@neondatabase/serverless`, raw SQL, no ORM
- Zod for the spec schema shared by the builder, runtime, and repair

## Setup

Prerequisites: Node 20+, a Vercel account with access to the `agents` team.

```bash
git clone https://github.com/RonKat2008/agent-factory && cd agent-factory
npm i
vercel link                 # team: agents, project: agent-factory
vercel env pull .env.local
npm run db:migrate
npm run dev                 # http://localhost:3000
npm run db:seed             # in a second terminal: seeds the 3 demo agents
```

`vercel env pull` supplies `DATABASE_URL` (Neon integration) and a `VERCEL_OIDC_TOKEN` that authenticates AI Gateway locally. Set `DEMO_MODE=true` to run with canned AI replies and no gateway access.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string, from the Vercel Neon integration. |
| `AI_GATEWAY_API_KEY` | AI Gateway key. Optional locally because the OIDC token from `vercel env pull` works. |
| `MODEL_SMART` | Gateway model for build, revise, repair, edit. Default `anthropic/claude-sonnet-5.5`. |
| `MODEL_FAST` | Gateway model for `llm` blocks and `llm_judge`. Default `anthropic/claude-haiku-5.5`. |
| `CRON_SECRET` | Bearer secret Vercel Cron sends to `/api/cron/tick`. |
| `ADMIN_KEY` | Key guarding the demo endpoints (`?key=`). |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook that agent outputs post to. |
| `GITHUB_TOKEN` | Token for the `github_issues` block. |
| `APP_URL` | Public base URL, `http://localhost:3000` locally. Used in Slack feedback links. |
| `DEMO_MODE` | `true` serves canned AI replies from `src/lib/demo.ts`. Default `false`. |

Other scripts: `npm run verify` (typecheck, lint, build), `npm run preflight`.

## Demo controls

The app serves a fake competitor site at `/demo/acme` so repair can be shown on demand. All three endpoints need `?key=$ADMIN_KEY`.

```bash
# Acme "redesigns": changelog moves to /demo/acme/updates, the old URL 404s
curl -X POST "$APP_URL/api/demo/break?key=$ADMIN_KEY"

# Restore Acme, roll the competitor watcher back to v1, clear its memory
curl -X POST "$APP_URL/api/demo/reset?key=$ADMIN_KEY"

# Publish the demo state
curl -X POST "$APP_URL/api/demo/publish?key=$ADMIN_KEY"
```

Typical sequence: reset, break, click Run now on Competitor watcher, watch the feed go broke, repairing, tests passed, v2 live.

## API

Dashboard reads and factory actions are documented in [`docs/API.md`](docs/API.md). Product plan and demo script: [`docs/SPEC.md`](docs/SPEC.md). Submission text: [`docs/PITCH.md`](docs/PITCH.md).

## Team

TBD
