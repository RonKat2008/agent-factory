# Teammate guide — UI lane (start here)

You own the **dashboard UI**. Ronit + Claude own the backend. We meet at a frozen data contract, so you can build everything against mock data right now and swap to the real API later with no redesign.

**Deadline:** submit by 15:50 PT. **Feature freeze 15:15.** Merge to `main` every 30–45 min.

## 1. Setup (10 min)
```bash
git clone https://github.com/RonKat2008/agent-factory && cd agent-factory
npm i
vercel link            # team: agents, project: agent-factory (accept the Vercel team invite first)
vercel env pull .env.local
git switch -c ui/fleet
npm run dev            # http://localhost:3000
claude                 # Claude Code reads CLAUDE.md (lane rules) automatically
```
Before every merge: `npm run verify` must pass.

## 2. Read these (5 min)
- `docs/SPEC.md` §1 — the 3-minute demo script. **The UI exists to make that script land.**
- `src/lib/types.ts` — every type the API returns (Agent, Run, FeedEvent, Stats, AgentVersion…).
- `docs/API.md` — every route + response shape.
- `src/lib/spec.ts` — what an agent spec looks like (for the plan card + version diff).

## 3. Lane rules
- **You own:** `src/app/(dashboard)/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**`, `src/lib/mock.ts`, `src/lib/api-client.ts`.
- **Don't edit:** `src/lib/types.ts`, `src/lib/spec.ts`, `docs/API.md` (ask Ronit — backend changes them), or anything under `src/app/api/**`, `src/lib/**` (other than your two files), `src/workflows/**`.
- Branches `ui/<thing>`, merge to `main` often, never force-push.

## 4. How to stay swappable
1. Create `src/lib/mock.ts` with realistic data typed with `src/lib/types.ts` (3 agents: "Daily AI agents brief", "Competitor watcher: Acme", "Next.js release watcher"; ~20 events incl. broke → repairing → repaired; a run with steps + tests; 2 versions where v2 is `createdBy: "factory"`, reason `auto-repair: …`).
2. Create `src/lib/api-client.ts` with one function per route in API.md (`getAgents()`, `getAgent(id)`, `getFeed(since)`, `getStats()`, `createAgent(request)`, `goLive(id)`, `runNow(id)`, `pause(id, paused)`, `setApproval(id, on)`, `editAgent(id, instruction)`, `acceptVersion`, `rejectVersion`, `approveRun`). While `NEXT_PUBLIC_USE_MOCKS=true` they return mock data; otherwise `fetch('/api/...')`.
3. Pages only call `api-client.ts`. Poll with a 3s interval (feed, agent status during build/repair).

## 5. Your tasks (in order)
| By | Page | Must show |
|---|---|---|
| 12:45 | **Fleet** `/` | Header numbers (agents live · runs today · auto-repairs · total $). One card per agent: name, status pill (live green / broken red / repairing amber pulsing / paused gray / building+testing blue), health ring (0–100), last run, next run, success rate, cost, 👍 rate, **Run now** button. Live activity feed (polls `/api/feed` every 3s; icons per event type; repair events stand out). "New agent" button. |
| 13:30 | **Create** `/new` | One big textarea ("Describe a recurring job…") → POST → **plan card** (Runs / Checks / Does / Sends to / Asks before from `agent.plan`) → **live build log** (events for that agent: built → dry_run → test_failed → self_fixed → tests_passed) → **Go live** button when status is `ready`. |
| 14:30 | **Agent detail** `/agents/[id]` | Run timeline (status, kind, cost, time); expand a run → step trace (block, ms, input/output JSON collapsible, error in red) + test results (pass/fail + detail) + output with clickable citations. **Version history**: each version with reason + createdBy badge (user/factory), a JSON **diff** vs parent, tests added highlighted, Accept/Reject on `proposed` versions. **Steering panel**: "Edit in plain English" box, Pause/Resume, Run now, Require-approval toggle, Approve/Reject on `awaiting_approval` runs. |
| 15:00 | **Swap mocks → real API**, polish, `/outbox` strip (optional: recent Slack messages). |
| 15:15 | Freeze. Record the backup demo video (screen + voice, follow SPEC §1). |

## 6. Design direction
"Factory floor control room": warm off-white (#F6F4EF), near-black text, dense data, **Geist Mono** for every number/id/time/cost, Geist Sans for labels. Status color is semantic only. 1px borders, small radii, no gradient blobs, no generic card grid. The feed should feel like a live ticker. Light mode only.

## 7. v0 prompt (paste into v0.dev, one page at a time)
> Build a Next.js App Router + Tailwind + shadcn/ui page for "Agent Factory", a control room for autonomous AI agents that run on schedules, test themselves and self-repair. Style: industrial ops console — warm off-white #F6F4EF background, near-black text, Geist Sans for labels and Geist Mono for all numbers/ids/timestamps/costs, 1px borders, small radii, dense, no gradients, light mode. Status colors are semantic only: live=green, broken=red, repairing=amber pulsing, paused=gray, building/testing=blue. Use these exact TypeScript types for props and mock data: [paste the contents of src/lib/types.ts here]. Page: [paste the row for the page from section 5 above].

Then "Add to Codebase" → run the `npx shadcn add …` command it gives you → move the page into `src/app/(dashboard)/…` and point it at `api-client.ts`.

## 8. Questions / blockers
Ask Ronit. Track progress in `docs/STATUS.md` (add a "UI lane" line when you merge).
