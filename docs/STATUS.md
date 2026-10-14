# Status: Pitcrew

Product renamed from Agent Factory to **Pitcrew** (F1 pit-stop theme). Live: https://agent-factory-steel.vercel.app
Alias: TBD

**Why Pitcrew:** built at an event with an F1 team, so we leaned in. Your agents get a pit crew: built, tested, running, and fixed in seconds when they break.

Updated: 2026-10-14. Submit by 15:50 PT. Feature freeze 15:15.

## Done
- Core: spec schema, 12 blocks, 6 test kinds, runtime, Workflow DevKit workflows (run, build, repair), cron tick, Neon persistence.
- Test-gated delivery; judge-only failures hold the post.
- Self-repair (~8s) with regression tests; public Tour (break, publish, reset).
- Agent chains (Acme watcher -> Competitor deep-dive with Exa) and the fleet knowledge graph with the `recall` block.
- Graph page (Flow and Knowledge views); Team radio / Ask Ops (Cmd+K) with approvals, backed by the eve Fleet Ops agent.
- Beginner home, 3-step create flow, Slack preview, "Send me a test now", editable schedule.
- Sign in with Slack (code complete); custom connectors (HTTP and MCP) with a Build a connector guide; Exa, Kernel, Context7, DeepWiki connected.
- Vercel Sandbox `run_code`; Export as eve agent; English edits, approvals, thumbs-down to proposed fix.
- BotID, rate limits, encrypted credentials; Analytics and Speed Insights; Neon dev branch vs prod database.
- Production deployed and seeded (3 agents, chain agent, knowledge backfill).
- Docs: README, PITCH, DEMO, STATUS, TEAMMATE.

## Remaining
- Slack app credentials (`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_STATE_SECRET`) set in Vercel, redirect URL registered.
- Rehearsal of `docs/DEMO.md`, at least twice before 15:15.
- Backup video at 15:15 (under 3 minutes).
- Devpost submit before 15:50, using `docs/PITCH.md`; fill in team names in the README.

## Blockers
- None known. Slack OAuth cannot be tested end to end until the credentials exist; the Outbox and `SLACK_WEBHOOK_URL` fallback cover the demo.
