# Pitcrew teammate guide: demo and submission

**Why Pitcrew:** built at an event with an F1 team, so we leaned in. Your agents get a pit crew: built, tested, running, and fixed in seconds when they break.

Your role is demo and submission: you present or back up the demo, own the Devpost submission, record the backup video, and click-test the deployed app. Ronit and Claude handle the code.

**Deadline:** submit by 15:50 PT. **Feature freeze 15:15.**

Live app: https://agent-factory-steel.vercel.app (Tour at `/tour`). Fleet Ops agent: https://agent-factory-ops.vercel.app.

## Your jobs

### (a) Slack app credentials (do first)
Create a Slack app at https://api.slack.com/apps for "Sign in with Slack" / Add to Slack and send the client ID, client secret, and signing/state secret to Ronit privately (do not post or commit them). Ronit sets `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_STATE_SECRET` in Vercel. The redirect URL to register is the app's `/api/slack/oauth/callback` callback on https://agent-factory-steel.vercel.app. Also create a `#factory-demo` channel for the demo posts.

### (b) Own the Devpost submission
Paste each field from `docs/PITCH.md` into Devpost. Add the live URL, the repo link, the team names, and the backup video, then submit before 15:50.

### (c) Rehearse and record the backup video
- Rehearse `docs/DEMO.md` end to end at least twice before 15:15.
- At 15:15, record the backup video (screen plus voice, QuickTime or Loom), under 3 minutes, following `docs/DEMO.md`. Share the file with Ronit.

### (d) Click-test the deployed app
Play Maya, an ops lead who is not a developer. Click every page (My agents, an agent's detail and version diff, Tour, Graph, Connections, Outbox), the create flow (including "Send me a test now"), and Cmd+K Ask Ops. Report anything broken, confusing, or slow to Ronit: the page, what you clicked, what happened, with a screenshot.

## Pointers
- Demo script: `docs/DEMO.md`. Submission text: `docs/PITCH.md`. Status: `docs/STATUS.md`.
- Demo controls (Break, Publish, Reset) are buttons on the Tour page; the API versions need the admin key from Ronit.
- Running locally is optional: see the README setup section. `DEMO_MODE=true` uses canned AI replies.
