# API contract (FROZEN — changes go here first, owned by backend lane)

Types live in `src/lib/types.ts`. All JSON. Errors: `{ "error": string }` with a 4xx/5xx status.
No auth on dashboard routes (public demo). Admin routes need `?key=$ADMIN_KEY`.

## Read (dashboard polls these)
| Method | Route | Response |
|---|---|---|
| GET | `/api/agents` | `{ agents: Agent[] }` |
| GET | `/api/agents/:id` | `AgentDetail` |
| GET | `/api/runs/:id` | `{ run: Run }` (with steps + tests) |
| GET | `/api/feed?since=<iso>&agentId=<id>` | `{ events: FeedEvent[] }` newest first, max 50 |
| GET | `/api/stats` | `Stats` |
| GET | `/api/outbox` | `{ messages: OutboxMessage[] }` newest first, max 30 |

## Factory actions
| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/agents` | `{ request: string }` | `{ agentId }` — starts buildAgent; poll `/api/feed?agentId=` + `/api/agents/:id` |
| POST | `/api/agents/:id/golive` | – | `{ agent: Agent }` (only from `ready`) |
| POST | `/api/agents/:id/run` | – | `{ runId }` manual run (Run now) |
| POST | `/api/agents/:id/pause` | `{ paused: boolean }` | `{ agent: Agent }` |
| POST | `/api/agents/:id/approval` | `{ requiresApproval: boolean }` | `{ agent: Agent }` |
| POST | `/api/agents/:id/edit` | `{ instruction: string }` | `{ version }` — new version, dry-run + tests; becomes active only if tests pass |
| POST | `/api/agents/:id/versions/:v/accept` | – | `{ agent: Agent }` (activates a `proposed` version) |
| POST | `/api/agents/:id/versions/:v/reject` | – | `{ ok: true }` |
| POST | `/api/runs/:id/approve` | `{ approve: boolean }` | `{ run: Run }` |

## Feedback (links in Slack messages)
`GET /f/:runId?r=useful|not_useful` → HTML thank-you page; `not_useful` shows an optional comment form
→ `POST /api/feedback` `{ runId, rating, comment? }` → may create a `proposed` version.

## System
| Method | Route | Notes |
|---|---|---|
| GET | `/api/cron/tick` | `Authorization: Bearer $CRON_SECRET`. Atomically claims due agents, starts runs. `{ started: string[] }` |
| GET | `/api/health` | `{ ok, db }` |
| POST | `/api/demo/break?key=` | Acme moves changelog → `/demo/acme/updates`, old URL 404s |
| POST | `/api/demo/publish?key=` | Acme publishes the next changelog entry (gives the watcher something new) |
| POST | `/api/demo/seed?key=` | Idempotently seeds the 3 demo agents |
| POST | `/api/demo/reset?key=` | Acme restored, watcher rolled back to v1, its memory cleared |

## Demo site (served by this app)
`/demo/acme` (homepage, links to the changelog), `/demo/acme/changelog`, `/demo/acme/updates`.
