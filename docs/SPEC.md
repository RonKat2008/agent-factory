# SPEC — Agent Factory (the plan)

Status: approved 2026-10-14 11:40 PT. Deadline 16:00 PT, submit by 15:50. Feature freeze 15:15.

> "Other tools help you build an agent. Ours takes responsibility for keeping it working."
> Describe a recurring job in one sentence → the factory builds the agent, writes tests, ships only if
> tests pass, runs it on a schedule, and repairs it when it breaks — while you're away.

## 1. Demo script (3:00)
1. 0:00 Maya runs ops at a 10-person startup: recurring jobs nobody has time for, automations that break silently.
2. 0:20 **Fleet page**: 3 agents running since ~12:30 — health ring, runs, cost, 👍 rate; header: agents live · runs today · auto-repairs · total $. Live activity feed.
3. 0:50 **WOW**: "Acme just redesigned." Hit Break → Run now on Competitor watcher. Feed: broke (404) → repairing → "found /demo/acme/updates" → tests passed → v2 live. Slack: "I fixed X because Y, and added a regression test. [diff]". Open version diff: URL changed, +1 test, created by factory.
4. 1:40 **Build live**: type a job → plan card (Runs / Checks / Does / Sends to / Asks before) → build log: dry run → test failed → self-fixed → passed → Go live.
5. 2:20 **Steer**: English edit ("only posts with 100+ points") → v2 re-tested; approval toggle; 👎 on a Slack post → proposed edit appears.
6. 2:45 Pitch line. "Built on Vercel Workflows, AI Gateway, Neon."

## 2. Features
- **MUST**: spec schema; blocks fetch_url, fetch_rss, hn_search, llm, filter, diff_with_memory, send_slack; runAgent; cron tick; 6 test kinds; buildAgent with ≤3 revise loop; repairAgent with link-candidate heuristic + regression test; Acme site + break/reset; read APIs; Run now / Pause / Go live; feedback links; outbox; DEMO_MODE canned AI; dashboard (fleet, create, detail).
- **SHOULD**: English edit; approval toggle + require_approval + approve/reject; 👎 → proposed version; github_issues + issue triager agent.
- **WON'T**: auth, per-agent Neon branches, eve export, email, Vercel Connect (pitch only), generated code.

## 3. Data model — Neon Postgres (`db/schema.sql`, `npm run db:migrate`)
agents, agent_versions (spec jsonb incl. tests, status active|proposed|rejected), runs, step_runs, test_results,
feedback, agent_memory, events, outbox, demo_state. No auth / RLS: public demo dashboard; admin routes key-gated.
Raw SQL via `@neondatabase/serverless` (`src/lib/db.ts`). No ORM.

## 4. AI design — AI SDK via Vercel AI Gateway (OIDC on Vercel; `vercel env pull` locally)
| id | model env (default) | in → out (structured, Zod) | budget |
|---|---|---|---|
| build | MODEL_SMART (Sonnet 5.5) | request + block catalog → AgentSpec | 20s |
| revise | MODEL_SMART | spec + failed tests + step outputs → AgentSpec | 20s |
| repair | MODEL_SMART | error, failing step I/O, last good output, verified link candidates → {diagnosis, spec, regressionTest} | 25s |
| edit | MODEL_SMART | spec + English instruction/feedback → {spec, changeSummary} | 20s |
| llm block | MODEL_FAST (Haiku 5.5) | instruction + input → text / cited_bullets / issue_labels | 10s |
| llm_judge | MODEL_FAST | rubric + message → {pass, reason} | 8s |

Every AI call has a `DEMO_MODE=true` canned path (`src/lib/demo.ts`). Cost per call from gateway usage → `runs.cost_usd`.

## 5. API contract — `docs/API.md` (frozen). Types — `src/lib/types.ts`, spec — `src/lib/spec.ts`.

## 6. Lanes (two people)
- **Backend lane (Ronit + Claude)** owns: `src/lib/**` (except `src/lib/mock.ts`, `src/lib/api-client.ts`), `src/app/api/**`, `src/app/f/**`, `src/app/demo/**`, `src/workflows/**`, `db/**`, `scripts/**`, `vercel.json`, `next.config.ts`, `docs/API.md`, `docs/SPEC.md`.
- **UI lane (teammate + v0)** owns: `src/app/(dashboard)/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**`, `src/lib/mock.ts`, `src/lib/api-client.ts`.
- Contract files (`src/lib/types.ts`, `src/lib/spec.ts`, `docs/API.md`) change only via the backend lane.
- Branches `be/*` and `ui/*`, merge to `main` every 30–45 min; never force-push.
- Riskiest unknown, spiked first: Workflow DevKit on Next 16 (fallback: plain sequential runner behind the same `runAgent()` signature).

## 7. Backend tasks (subagent-driven)
### Task 1: Foundation — Neon, AI Gateway, Workflow spike
Remove Supabase + Anthropic SDK entirely; add `ai`, `zod`, `@neondatabase/serverless`, `workflow`, `cron-parser`, `cronstrue`.
`src/lib/db.ts`, `scripts/migrate.mjs` + `npm run db:migrate`, `src/lib/ai.ts` (gateway models + cost helper),
`/api/health` queries DB, `vercel.json` cron `* * * * *` → `/api/cron/tick`, Workflow spike (2-step workflow + `/api/spike`), `.env.example`, preflight.
### Task 2: Blocks, templating, test runner
`src/lib/runtime/template.ts`, `src/lib/blocks/*` + registry + catalog text for the builder prompt, `src/lib/runtime/output.ts`, `src/lib/runtime/tests.ts`.
### Task 3: Persistence + read APIs
`src/lib/repo.ts` (all SQL ↔ types mapping, events helper), GET routes from API.md, stats, feed.
### Task 4: runAgent + cron + actions + Acme demo + seed
`src/workflows/run-agent.ts`, `/api/cron/tick`, run/pause/golive/approval routes, outbox + Slack send with feedback links, `/f/[runId]` + `/api/feedback`, `/demo/acme/*` + break/reset, `scripts/seed.mjs` (3 agents).
### Task 5: buildAgent + edit
`src/workflows/build-agent.ts`, `POST /api/agents`, `POST /api/agents/:id/edit`.
### Task 6: repairAgent (the wow)
`src/workflows/repair-agent.ts`, link-candidate heuristic, regression test, Slack fix message, canned DEMO_MODE repair, triggered from runAgent.
### Task 7: Steering extras
require_approval + approve/reject, 👎 → proposed version, accept/reject version routes.

## 8. Cut-lines
- 11:55 Workflow spike not green → plain runner.
- 13:00 no Slack/outbox post from a scheduled prod run → drop fetch_rss/filter from seeds, ship 2 agents.
- 13:45 builder not done → 1 revise retry, start repair anyway.
- 14:30 repair flaky → DEMO_MODE deterministic repair carries the demo.
- 15:00 behind → cut 👎→proposed edit, then approval.
- 15:15 FREEZE: rehearse ×3, record backup video, README.
