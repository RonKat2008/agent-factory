<div align="center">

# Pitcrew

### Your AI agents get a pit crew.

**Other tools help you build an agent. Pitcrew takes responsibility for keeping it running.**

[![Live demo](https://img.shields.io/badge/live_demo-pitcrew--ai.vercel.app-e10600?style=for-the-badge)](https://pitcrew-ai.vercel.app)
[![Built on Vercel](https://img.shields.io/badge/built_on-Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![Neon](https://img.shields.io/badge/Postgres-Neon-00e599?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![eve](https://img.shields.io/badge/Fleet_Ops-eve-5b5bd6?style=for-the-badge)](https://agent-factory-ops.vercel.app)
[![Track](https://img.shields.io/badge/track-Agents_%26_Factories-ff8a00?style=for-the-badge)](#)

## [▶ Try the 3-minute judge tour](https://pitcrew-ai.vercel.app/tour)

<sub>No sign-in needed. Eight guided chapters, every feature live on production.</sub>

<br/>

<img src="docs/images/my-agents.jpg" alt="My agents: the fleet with health, last output and run history" width="900"/>

</div>

<br/>

> **Why "Pitcrew"?** We built this at an event alongside an F1 team, so we leaned in. A race car doesn't finish without the crew that refuels it, swaps tires, and fixes damage in seconds. Every agent you build here gets one.

---

## What it does in 30 seconds

- **One sentence in, a tested agent out.** "Watch Acme's changelog and tell me in Slack when they ship." Pitcrew writes the spec, dry-runs it on real data, writes tests, fixes its own failures, and shows you a plain-English plan and a Slack preview before you turn it on.
- **Nothing ships unless the tests pass.** Every run is gated on the agent's tests. An LLM judge sees the source material and fails only verifiable violations.
- **It fixes itself.** When a source breaks, Pitcrew diagnoses it, finds the fix, proves it with a dry run, and ships v2 with a new regression test. On production this takes about 8 seconds.
- **Agents trigger agents.** A watcher's post kicks off a deep-dive agent that researches with Exa and posts a cited analysis about a second later.
- **You stay in control.** Plain-English edits, approval gates, 👎 feedback that becomes a proposed fix, and a ⌘K chat with an eve Fleet Ops agent that asks before it changes anything.

---

## The pit stop

The signature feature. The fake competitor site Acme "redesigns" and moves its changelog. The watcher's fetch returns 404. Pitcrew repairs it without a human:

```mermaid
sequenceDiagram
    autonumber
    participant Cron as "Vercel Cron"
    participant Run as "runAgent workflow"
    participant Acme as "Acme site"
    participant Repair as "repairAgent workflow"
    participant LLM as "Sonnet 5.5 via AI Gateway"
    participant DB as "Neon"
    participant Slack as "Slack"

    Cron->>Run: due agent claimed atomically
    Run->>Acme: fetch_url /changelog
    Acme-->>Run: 404 Not Found
    Run->>DB: step_runs error recorded, agent marked broken
    Run->>Repair: start repair
    Repair->>DB: load failing step I/O and last good output
    Repair->>Acme: fetch homepage, collect and verify link candidates
    Acme-->>Repair: new changelog URL found in homepage links
    Repair->>LLM: diagnose and propose a spec patch
    LLM-->>Repair: patched spec plus step_succeeds regression test
    Repair->>Run: dry run of the patched spec on real data
    Run-->>Repair: 4 of 4 tests pass
    Repair->>DB: ship v2 as the active version, old version kept
    Repair->>Slack: Pit stop complete notice
    Note over Cron,Slack: About 8 seconds end to end on production. One live run took 4s.
```

The Slack notice reads **"🏁 Pit stop complete…"**. The agent page shows the version diff: the URL changed and one regression test was added. Failures become tests, so the same break can never ship silently again.

<div align="center">
<img src="docs/images/agent-detail.jpg" alt="Agent detail: latest output, run strip, versions and the repair diff" width="900"/>
</div>

---

## Chain reaction

Chains are data: an agent's spec can say "when agent A posts, run me with A's output". The Acme watcher feeds the Competitor deep-dive.

```mermaid
flowchart LR
    W["Competitor watcher: Acme"] -->|"posts a new release"| S1["Slack post"]
    W -->|"event trigger, about 1s"| G{"Loop guards"}
    G -->|"depth under 3, no cycle, not self"| D["Competitor deep-dive"]
    G -.->|"4th hop or cycle"| X["chain_skipped event"]
    D -->|"connector block"| E["Exa search via MCP"]
    E --> A["llm block: cited competitive analysis"]
    A --> T{"Tests pass?"}
    T -->|"yes"| S2["Slack post with sources"]
    T -.->|"no"| H["Held in Outbox"]
    S1 --> K[("Knowledge graph")]
    S2 --> K
```

A real analysis from production: *"Acme launched iOS and Android apps… Power BI and Qlik lead on offline use… we should prioritize mobile alert workflows"*, with its source (basedash.com) cited.

**Loop guards:** an agent cannot trigger itself; a trigger that would form a cycle is rejected at build or edit time; chains stop at 3 hops (`MAX_CHAIN_DEPTH`) and the 4th hop is logged as a `chain_skipped` event.

---

## Architecture

```mermaid
flowchart TB
    subgraph Browser["Browser"]
        P1["Home and Create"]
        P2["My agents and Agent detail"]
        P3["Graph: Flow and Knowledge"]
        P4["Judge tour"]
        P5["Outbox and Connections"]
        P6["Team radio, Cmd K"]
    end

    subgraph Vercel["Vercel: pitcrew-ai.vercel.app"]
        BOT["BotID and rate limits"]
        FN["Next.js 16 Functions on Fluid compute"]
        CRON["Cron, every minute"]
        WF["Workflow DevKit: runAgent, buildAgent, repairAgent, editAgent"]
        GW["AI SDK and AI Gateway"]
        SB["Sandbox microVM for run_code"]
    end

    subgraph Eve["eve Fleet Ops: separate Vercel project"]
        OPS["Fleet Ops agent"]
    end

    subgraph Neon["Neon Postgres"]
        DB[("16 tables")]
    end

    subgraph Ext["External"]
        SL["Slack OAuth and chat"]
        MCP["Exa, Kernel, Context7, DeepWiki over MCP"]
        WEB["Hacker News, RSS, web pages, GitHub"]
    end

    Browser --> BOT --> FN
    CRON --> FN
    FN --> WF
    WF --> GW
    WF --> SB
    WF --> MCP
    WF --> WEB
    WF --> SL
    FN --> DB
    WF --> DB
    P6 --> FN
    FN <-->|"chat stream, approval-gated actions"| OPS
    GW -->|"Sonnet 5.5 builds and repairs, Haiku 5.5 runs and judges"| LLM["Anthropic models"]
```

<div align="center">
<img src="docs/images/graph.jpg" alt="Graph page: Flow view of agents, chains and connectors" width="900"/>
</div>

---

## How an agent is built

An agent is not generated code. It is a **JSON spec over a fixed block library** (`src/lib/spec.ts`, Zod-validated): a schedule, ordered steps, tests, and a plan card. Every build, edit and repair is a versioned diff that can be tested, shown, and rolled back.

```mermaid
stateDiagram-v2
    [*] --> building: one-sentence request
    building --> testing: spec drafted
    testing --> building: tests fail, self-fix up to 3 times
    testing --> ready: all tests pass on a dry run
    ready --> live: Turn on
    live --> live: scheduled run, tests pass, post delivered
    live --> broken: a step fails
    broken --> repairing: repairAgent starts
    repairing --> live: patched v2 passes all tests
    repairing --> needs_human: no verified fix
    needs_human --> live: human edit passes tests
    live --> paused: paused by user or Fleet Ops
    paused --> live: resumed
```

The builder flow: **one sentence → spec → dry run on real data → tests → self-fix → plain-English plan → Slack preview → "Send me a test now" → Turn on.**

<details>
<summary><b>Example spec: the Acme competitor watcher</b> (from <code>src/lib/seed-specs.ts</code>)</summary>

```json
{
  "name": "Competitor watcher: Acme",
  "schedule": "*/15 * * * *",
  "requiresApproval": false,
  "steps": [
    { "id": "page", "block": "fetch_url", "params": { "url": "https://pitcrew-ai.vercel.app/demo/acme/changelog" } },
    { "id": "diff", "block": "diff_with_memory", "params": { "input": "{{steps.page.text}}", "memoryKey": "acme_changelog" } },
    {
      "id": "summary",
      "block": "llm",
      "params": {
        "instruction": "Summarize each new changelog entry in one bullet. Cite the page URL given as Source. If there are no changes return an empty list.",
        "input": "Source: {{steps.page.url}}\nNew entries:\n{{steps.diff.text}}",
        "format": "cited_bullets"
      }
    },
    { "id": "send", "block": "send_slack", "params": { "message": "*Acme shipped something*\n{{steps.summary.markdown}}", "skipIfEmpty": true } }
  ],
  "tests": [
    { "kind": "has_citations", "addedBy": "build" },
    { "kind": "no_post_if_unchanged", "addedBy": "build" },
    { "kind": "llm_judge", "config": { "rubric": "Only mentions changes present in the source; under 120 words." }, "addedBy": "build" }
  ],
  "plan": { "runs": "Every 15 minutes", "sendsTo": "Slack", "asksBefore": "Nothing" }
}
```

Steps reference earlier outputs with templates like `{{steps.page.text}}`. Blocks never throw; they return `{ ok, output | error }`, which gives repair precise evidence to work from.

</details>

---

## Feature tour

| Area | Feature |
|---|---|
| **Build** | One sentence becomes a Zod-validated spec, dry-run on real sources, revised up to 3 times from failed tests. |
| | Plain-English plan card, Slack preview, "Send me a test now", editable schedule, then Turn on. |
| | Export any proven agent as a standalone eve project. |
| **Run** | Vercel Cron ticks every minute and atomically claims due agents. |
| | Each run is a durable Workflow DevKit workflow, one step per block, every step's I/O recorded. |
| | Cost tracked per AI call: about $0.0003 to $0.001 per run. |
| **Test** | Test-gated delivery: nothing posts unless every test passes. Judge-only failures hold the post. |
| | LLM judge sees the source material and fails only verifiable violations. |
| **Repair** | Pit stop in about 8 seconds: diagnose, find a verified candidate, patch, re-test, ship v+1. |
| | Every repair adds a `step_succeeds` regression test for the exact break. |
| **Steer** | Plain-English edits ("only posts with 100+ points") produce a re-tested new version. |
| | `require_approval` pauses a run for a human; 👎 on a Slack post becomes a proposed fix. |
| | Team radio (⌘K): chat with the eve Fleet Ops agent; fleet-changing actions need approval. |
| **Connect** | Sign in with Slack: any visitor connects a workspace, and their agents post to their channel. |
| | Community connectors anyone can add (HTTP API or MCP). Exa, Kernel, Context7, DeepWiki connected; risky tools trimmed. |
| | Vercel Sandbox `run_code` block; GitHub for `github_issues`. |
| **Observe** | My agents: health, last output, run strip, sparklines, live activity feed. |
| | Graph page: Flow view (chains, connectors) and Knowledge view (34+ entities extracted across agents). |
| | Outbox for every message, delivered or held. Onboarding and Explain mode for first-time visitors. |

---

## Built with Vercel

| Product | What it does in Pitcrew |
|---|---|
| **Hosting + Fluid compute** | Serves the Next.js 16 app and APIs; runs long build, repair and Team radio streaming requests. |
| **Cron** | Ticks every minute and claims due agents with an atomic claim, so no agent runs twice. |
| **Workflow DevKit** | `runAgent`, `buildAgent`, `repairAgent` and `editAgent` are durable workflows, one retryable step per block. |
| **AI SDK + AI Gateway** | Structured generation and tool use. Sonnet 5.5 builds and repairs; Haiku 5.5 runs steps and judges. Cost per call recorded. |
| **Sandbox** | Firecracker microVM behind the `run_code` block. |
| **eve** | The Fleet Ops agent, deployed as its own project ([agent-factory-ops.vercel.app](https://agent-factory-ops.vercel.app)), plus Export as eve agent. |
| **BotID** | Blocks bots on public AI routes and Slack feedback links. |
| **Web Analytics** | Traffic on the app and tour. |
| **Speed Insights** | Core Web Vitals in production. |

**Neon.** All state lives in 16 Postgres tables, accessed through `@neondatabase/serverless` with parameterized SQL and no ORM. Rate limiting is Postgres-backed. Development runs on a Neon `dev` branch; production runs on an isolated `factory_prod` database. The project was provisioned through the Neon MCP.

---

## Data model

```mermaid
erDiagram
    agents ||--o{ agent_versions : "has versions"
    agents ||--o{ runs : "runs"
    runs ||--o{ step_runs : "records each step"
    runs ||--o{ test_results : "is gated by"
    runs ||--o{ feedback : "receives"
    agents ||--o{ feedback : "receives"
    agents ||--o{ agent_memory : "remembers"
    agents ||--o{ events : "emits"
    agents ||--o{ outbox : "sends"
    runs ||--o{ outbox : "produces"
    kg_entities ||--o{ kg_mentions : "mentioned in"
    agents ||--o{ kg_mentions : "mentions"
    users ||--o{ visitor_connections : "same visitor id"

    agents {
        uuid id PK
        text name
        text status
        timestamptz next_run_at
    }
    agent_versions {
        uuid agent_id FK
        int version
        jsonb spec
        text status
    }
    runs {
        uuid id PK
        uuid agent_id FK
        text status
    }
    step_runs {
        uuid run_id FK
        text status
    }
    test_results {
        uuid run_id FK
    }
    kg_entities {
        uuid id PK
        text name
    }
    kg_mentions {
        uuid entity_id FK
        uuid agent_id FK
    }
    custom_connectors {
        uuid id PK
        text name
    }
```

Also in `db/schema.sql`: `connections` (encrypted Slack, GitHub and connector credentials), `custom_connectors` (HTTP API and MCP definitions), and `demo_state` (Acme tour controls and the Postgres-backed rate-limit windows). `agents.owner_visitor_id` ties each agent to the visitor who built it.

---

## Block library

| Block | What it does |
|---|---|
| `fetch_url` | Fetch a page; return readable text and links. Fails on non-2xx. |
| `fetch_rss` | Read an RSS, Atom, or GitHub releases feed. |
| `hn_search` | Search Hacker News stories via Algolia. |
| `github_issues` | List open issues, or apply labels and comments. |
| `llm` | Summarize or classify; cited bullets may only use URLs present in the input. |
| `filter` | Keep items where a field passes `gt`, `gte`, `lt`, `lte`, `eq`, or `contains`. |
| `diff_with_memory` | Compare input with the last run and remember the new state. |
| `recall` | Read entities from the fleet knowledge graph. |
| `connector` | Call a custom connector (HTTP API or MCP tool). |
| `run_code` | Run code in a Vercel Sandbox microVM. |
| `send_slack` | Post to Slack with useful / not useful links; optional `skipIfEmpty`. |
| `require_approval` | Pause the run until a human approves or rejects. |

## Test kinds

| Test | Passes when |
|---|---|
| `nonempty` | The output has content. |
| `has_citations` | Every claim carries a source URL. |
| `max_items` | The output has at most `config.max` items. |
| `llm_judge` | A Haiku judge, given the source material, finds no verifiable violation of the rubric. |
| `no_post_if_unchanged` | Nothing is posted when the source did not change. |
| `step_succeeds` | A named step succeeds. Written by repair as the regression test. |

---

## Judge tour

<div align="center">
<img src="docs/images/tour.jpg" alt="The judge tour with eight guided chapters" width="900"/>
</div>

Open **[pitcrew-ai.vercel.app/tour](https://pitcrew-ai.vercel.app/tour)**. Public, no sign-in, every chapter runs against production:

1. **Build an agent from one sentence**
2. **Pit stop: it fixes itself** (Break, run, watch the repair, open the diff)
3. **Chain reaction** (Publish, the watcher posts, the deep-dive follows)
4. **See the whole system** (Flow and Knowledge graphs)
5. **Steer it in plain English**
6. **Ask your fleet** (⌘K Team radio with eve Fleet Ops)
7. **Connect anything** (Slack, MCP and HTTP connectors)
8. **Under the hood**

---

## Security & reliability

- **Test-gated delivery.** No version goes active and no message is posted unless its tests pass.
- **BotID** on public AI routes and feedback links, plus **rate limits** with per-key and global windows backed by Postgres.
- **SSRF guard.** Outbound fetches go through a guarded network helper.
- **Encrypted secrets.** Slack tokens, GitHub tokens and connector keys are encrypted at rest; none reach the client.
- **Approval gates.** `require_approval` steps and every fleet-changing Team radio action wait for a human.
- **Loop guards.** No self-triggers, no cycles, a 3-hop chain limit.
- **Abuse limits.** Minimum schedule interval and a live-agent cap per visitor; admin routes need `ADMIN_KEY`; the GitHub token is scoped to the connected repo.

---

## Run it locally

Prerequisites: Node 20+, a Vercel account, a Neon database.

```bash
git clone https://github.com/RonKat2008/agent-factory && cd agent-factory
npm i
vercel link && vercel env pull .env.local   # DATABASE_URL + VERCEL_OIDC_TOKEN for AI Gateway
npm run db:migrate                          # creates all 16 tables
npm run dev                                 # http://localhost:3000
npm run db:seed                             # second terminal: the 3 demo agents

# with the app running
curl -X POST "$APP_URL/api/demo/seed-chain?key=$ADMIN_KEY"     # add the chained deep-dive
curl -X POST "$APP_URL/api/knowledge/backfill?key=$ADMIN_KEY"  # fill the knowledge graph
```

<details>
<summary><b>Environment variables</b></summary>

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string. |
| `AI_GATEWAY_API_KEY` | AI Gateway key; optional locally, where `vercel env pull` supplies an OIDC token. |
| `MODEL_SMART` / `MODEL_FAST` | Gateway models. Defaults `anthropic/claude-sonnet-5.5` and `anthropic/claude-haiku-5.5`. |
| `CRON_SECRET` | Bearer secret Vercel Cron sends to `/api/cron/tick`. |
| `ADMIN_KEY` | Guards admin and demo endpoints and the admin session. |
| `APP_URL` | Public base URL, used in Slack feedback links. |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | Slack app credentials for Sign in with Slack. |
| `SLACK_STATE_SECRET` | Signs the OAuth state. |
| `CONNECTIONS_KEY` | Encryption key for stored credentials. |
| `OPS_URL` / `OPS_API_KEY` | Where the app reaches the eve Fleet Ops agent, and its bearer key. |
| `GITHUB_TOKEN` | Optional fallback token for `github_issues`. |
| `DEMO_MODE` | `true` serves canned AI replies with no gateway access. |

</details>

The Fleet Ops agent lives in `ops-agent/` and deploys as its own Vercel project. `npm run verify` runs typecheck, lint and build.

---

## Project structure

```text
agent-factory/
├── src/
│   ├── app/(dashboard)/   # home, agents, new, graph, tour, outbox, connections
│   ├── app/api/           # agents, runs, cron, ops, slack, connectors, knowledge, demo
│   ├── workflows/         # run-agent, build-agent, repair-agent, edit-agent (Workflow DevKit)
│   ├── lib/blocks/        # the 12-block library
│   ├── lib/factory/       # generate, repair, link candidates, feedback edits
│   ├── lib/runtime/       # block runner, templating, tests, delivery
│   ├── lib/spec.ts        # the agent spec schema (Zod)
│   └── components/        # UI: fleet, agent, graph, tour, ops, onboarding
├── ops-agent/             # eve Fleet Ops agent (separate Vercel project)
├── db/schema.sql          # 16 tables
├── scripts/               # migrate, seed, smoke tests, preflight
└── docs/                  # DEMO, PITCH, SPEC, API, images
```

---

## What's next

- **A Neon branch per agent**, so every repair and edit dry-runs against its own copy of state before promotion.
- More community connectors and a shared connector gallery.
- Fleet-level repair insights: which sources break most, and which fixes held.

## Team

Ronit & Vidya 

---

<div align="center">
<sub>Built for Vercel Fast Forward · Agents & Factories track · <a href="https://pitcrew-ai.vercel.app">pitcrew-ai.vercel.app</a></sub>
</div>
