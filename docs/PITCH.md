# Pitcrew: Devpost submission text

**Name:** Pitcrew

**Tagline:** Your AI agents get a pit crew.

**Pitch line:** Other tools help you build an agent. Pitcrew takes responsibility for keeping it running.

**Why Pitcrew:** built at an event with an F1 team, so we leaned in. Your agents get a pit crew: built, tested, running, and fixed in seconds when they break.

**Track:** Agents & Factories

**Links:** App https://agent-factory-steel.vercel.app (Tour at /tour) | Fleet Ops agent https://agent-factory-ops.vercel.app | Repo https://github.com/RonKat2008/agent-factory

## Description (under 200 words)

Pitcrew turns one sentence into a recurring agent that stays working. Describe a job, such as "every weekday, tell #product what our competitors shipped". Pitcrew plans it, assembles it from a fixed library of tested blocks, dry-runs it against real sources, writes tests, and posts to Slack only after the tests pass. You see a Slack preview and can send yourself a test before going live.

When a source changes and a run breaks, Pitcrew diagnoses the failure, patches the spec, re-tests, and promotes a new version in about 8 seconds. Every failure becomes a regression test, so the same break cannot ship twice. A thumbs-down on a post, or an English instruction like "only posts with 100+ points", becomes a proposed edit that is re-tested first.

Agents can trigger other agents: our competitor watcher fires a deep-dive agent that researches the release with Exa. Every post feeds a fleet knowledge graph that agents can recall. You can ask the eve-based Fleet Ops agent "why did the watcher break?" with Cmd+K. Anyone can sign in with Slack, add their own connectors (HTTP or MCP), and export an agent as an eve project. A run costs about $0.0003.

## Inspiration

Every agent builder helps you make the first version. Nobody owns version two hundred, after a site redesigns, an API changes a field, or a feed moves. Silent breakage is why people stop trusting automations. We wanted the builder to take responsibility for what it ships: test before deploying, fix what breaks, and tell you what it did.

## What it does

- Builds an agent from one sentence, with a plan card and Slack preview, and a "Send me a test now" button.
- Ships only if tests pass (test-gated delivery). If only the LLM judge fails, the post is held, not sent.
- Runs on a schedule, repairs itself when a step fails, and adds a regression test for each failure.
- Chains agents: one agent's post triggers another. Entities from every post build a fleet knowledge graph, shown on the Graph page alongside the agent flow.
- Steering: English edits, approval gates, thumbs-down feedback to a proposed fix, and Team radio (Ask Ops) chat with approvals.
- Connect: Sign in with Slack (posts go to the visitor's own channel), custom HTTP and MCP connectors (Exa, Kernel, Context7, DeepWiki connected), a Vercel Sandbox `run_code` block, and Export as eve agent.
- A public judge Tour lets anyone break a site and watch the repair.

## How we built it

Agents are Zod-validated JSON specs: a schedule, ordered steps from a fixed block library (fetch, RSS, HN search, GitHub issues, LLM, filter, diff-with-memory, recall, connector, run_code, send_slack, require_approval), and tests of six kinds. One runtime executes dry runs, scheduled runs, and tests, and records every step's input and output in Neon Postgres, which is the evidence repair works from. Three Vercel Workflow DevKit workflows make it durable: `runAgent` (claimed by a per-minute Vercel Cron tick), `buildAgent`, and `repairAgent`. Models run through the AI SDK and AI Gateway: Sonnet 5.5 builds and repairs, Haiku 5.5 runs steps and judges. The Fleet Ops agent is an eve project deployed as its own Vercel project. BotID and Postgres-backed rate limits guard public routes, credentials are encrypted, and Analytics and Speed Insights watch the app. Local development uses a Neon dev branch; production uses a separate database.

## Challenges

- **Making failure legible.** Blocks return results instead of throwing, and every step is persisted, so repair sees exactly what broke.
- **Keeping the repair model honest.** Unconstrained, it invents URLs. We give it verified link candidates and require old and new tests to pass before promotion.
- **Non-deterministic outputs behind a gate.** Deterministic tests carry most of the weight; an LLM judge covers the rest, and judge-only failures hold the post instead of blocking the agent.
- **Public demo safety.** Anyone can use it, so we added BotID, rate limits, schedule floors, per-visitor caps, and encrypted credentials. Feedback links are bot-safe.
- **Time.** One day, parallel Claude subagent lanes against a frozen API contract.

## Accomplishments we are proud of

- A real break-to-repaired loop on production in about 8 seconds, with a diff and a regression test.
- Agents chaining across a live Exa research connector, with a knowledge graph built from real posts.
- Any visitor can sign in with Slack and get posts in their own channel.
- A run costs about $0.0003.

## What we learned

- Specs over generated code is what makes repair, diffing, and testing tractable.
- Persisting every step's I/O matters more than the repair prompt.
- Gating on tests changes what you can safely automate: edits and repairs become routine because they cannot go live untested.

## What's next

- Per-agent Neon branches so a bad repair is discarded by dropping a branch.
- Vercel Connect for one-click authorization of more services.
- More blocks and first-party connectors: email, Linear, Notion, calendar.
- Team workspaces, so a fleet can be shared and reviewed.

## Built with

Next.js 16, React 19, Vercel hosting, Fluid compute, Vercel Cron, Workflow DevKit, AI SDK, AI Gateway (Claude Sonnet 5.5, Claude Haiku 5.5), Vercel Sandbox, eve, BotID, Web Analytics, Speed Insights, Neon Postgres, Zod, Slack API (OAuth), Exa, MCP.
