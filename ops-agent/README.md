# Fleet Ops (eve agent for Pitcrew)

Fleet Ops is a durable backend agent built on [eve](https://eve.dev). It watches the
Pitcrew fleet and helps a human steer it: why something broke, what got repaired,
and pause, edit or re-run agents in plain English. It runs as its **own Vercel project**
(`agent-factory-ops`). It only talks to Pitcrew's public JSON API, so if it fails
the main app is unaffected.

- Production: https://agent-factory-ops.vercel.app (health: `/eve/v1/health`)
- Factory API it calls: `FACTORY_URL` (default https://agent-factory-steel.vercel.app), see `../docs/API.md`
- Model: `anthropic/claude-sonnet-5.5` through the Vercel AI Gateway (project OIDC, no API key)

## Layout

```text
agent/
  agent.ts                 defineAgent (model, $2/session cost cap)
  instructions.md          persona and standing rules
  channels/eve.ts          HTTP route auth: Bearer OPS_API_KEY, Vercel OIDC, localDev
  lib/factory.ts           fetch wrapper and response compaction
  tools/                   one file per tool (filename = tool name)
  schedules/fleet-health.ts daily health report
```

## Tools

| Tool | Factory route | Approval |
|---|---|---|
| `list_agents` | GET `/api/agents` | none |
| `get_agent` | GET `/api/agents/:id` (versions with reasons, last runs, failures) | none |
| `fleet_feed` | GET `/api/feed?agentId&since` (also `sinceHours`) | none |
| `fleet_stats` | GET `/api/stats` | none |
| `run_agent` | POST `/api/agents/:id/run` | none |
| `pause_agent` | POST `/api/agents/:id/pause` `{paused:true}` | `always()` |
| `resume_agent` | POST `/api/agents/:id/pause` `{paused:false}` | none |
| `edit_agent` | POST `/api/agents/:id/edit` `{instruction}` | `always()` |
| `set_approval` | POST `/api/agents/:id/approval` `{requiresApproval}` | `always()` |
| `post_slack` | `SLACK_WEBHOOK_URL` incoming webhook (no-op if unset) | none |

Gated tools park the session durably (`input.requested`) until a human approves or cancels.

## Schedule

`agent/schedules/fleet-health.ts` runs `0 16 * * *` (16:00 UTC, 9am PT) as a Vercel Cron Job.
It gathers stats, the last 24h of feed events, and detail on failing, repaired, or blocked agents,
then posts a terse report with `post_slack`. If `SLACK_WEBHOOK_URL` is not set, the report is
the session's reply.

## Run locally (Node 24+)

```bash
cd ops-agent
npm install
npx eve dev            # terminal UI; or: npx eve dev --no-ui --port 2000
# AI Gateway auth: VERCEL_OIDC_TOKEN in .env.local (npx eve link pulls it)

curl -X POST localhost:2000/eve/v1/session -H 'content-type: application/json' \
  -d '{"message":"List the agents and their health"}'
curl -N localhost:2000/eve/v1/session/<sessionId>/stream      # NDJSON events
curl -X POST localhost:2000/eve/v1/dev/schedules/fleet-health # fire the schedule once
```

## Deploy

```bash
npx eve link --non-interactive --project agent-factory-ops --team agents-db31
vercel env add FACTORY_URL production    # https://agent-factory-steel.vercel.app
vercel env add OPS_API_KEY production    # shared bearer for callers
vercel env add SLACK_WEBHOOK_URL production   # optional
npx eve deploy --non-interactive --yes
```

Call the deployed agent with `Authorization: Bearer $OPS_API_KEY`:

```bash
curl -X POST https://agent-factory-ops.vercel.app/eve/v1/session \
  -H "authorization: Bearer $OPS_API_KEY" -H 'content-type: application/json' \
  -d '{"message":"Why did the Acme watcher break?"}'
```

Or open the terminal UI against it:
`npx eve remote connect --url https://agent-factory-ops.vercel.app -H "Authorization: Bearer $OPS_API_KEY"`.

## Example prompts

- "Why did the Acme watcher break?"
- "Pause the HN digest" (asks for approval)
- "Make the release assistant only flag security issues" (asks for approval, then Pitcrew dry-runs and tests the new version)
- "List the agents and their health"
- "What got repaired in the last 24 hours?"
