# Teammate guide: demo and submission

The UI lane is done. Claude subagents built all three dashboard pages (Fleet, Create, Agent detail) plus the Outbox. Your role is now **demo and submission**. Ronit and Claude are finishing the backend.

**Deadline:** submit by 15:50 PT. **Feature freeze 15:15.** All coordination docs live in `docs/` (`SPEC.md`, `API.md`, `PITCH.md`, `STATUS.md`).

## Your four jobs

### (a) Slack app and webhook (do first, it blocks the demo)
1. Create a `#factory-demo` channel in your Slack workspace.
2. Go to https://api.slack.com/apps and click **Create New App** > **From scratch**. Name it "Agent Factory" and pick the workspace.
3. Open **Incoming Webhooks** and toggle **Activate Incoming Webhooks** on.
4. Click **Add New Webhook to Workspace**, pick `#factory-demo`, and click **Allow**.
5. Copy the webhook URL (starts with `https://hooks.slack.com/services/`) and **send it to Ronit privately**. Do not post it in a public channel or commit it. Ronit sets it as `SLACK_WEBHOOK_URL` in Vercel.

### (b) Own the Devpost submission
Use `docs/PITCH.md`. It has the name, tagline, 150-word description, "How we built it", "Challenges", and "What's next". Paste each into the matching Devpost field. Fill in the live demo URL and repo link once Ronit confirms the prod deploy, attach the backup video from (c), and submit before 15:50.

### (c) Rehearse and record the backup video
- Rehearse the 3-minute script in `docs/PITCH.md` end to end at least twice before 15:15.
- At **15:15**, record the backup video: screen plus voice, using QuickTime (File > New Screen Recording) or Loom. Follow the script and keep it under 3 minutes. Save the file and share it with Ronit.

### (d) Be Maya: user-test the deployed app
You are the persona in the demo: an ops lead who is not a developer. On the deployed URL, click through every page (Fleet, Create, an agent's detail page and version diff, Outbox) and every button (Run now, Pause, Go live, approval toggle). Report anything broken, confusing, or slow to Ronit with the page, what you clicked, and what happened. Screenshots help.

## Running it locally (optional)
```bash
git clone https://github.com/RonKat2008/agent-factory && cd agent-factory
npm i
vercel link            # team: agents, project: agent-factory (accept the Vercel team invite first)
vercel env pull .env.local
npm run dev            # http://localhost:3000
```
Set `DEMO_MODE=true` in `.env.local` to use canned AI replies. Before any merge, `npm run verify` must pass.

## Useful pointers
- Demo script: `docs/PITCH.md` (also `docs/SPEC.md` section 1).
- What is done and what is blocked: `docs/STATUS.md`.
- Demo controls (admin key needed, ask Ronit): `POST /api/demo/break`, `/api/demo/reset`, `/api/demo/publish`. See the README.
