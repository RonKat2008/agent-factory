@AGENTS.md

# Hackathon project. Read `docs/STATUS.md` first.

This repo runs in **hackathon mode**: ship a working, deployed, well-pitched demo before the deadline. The main session runs the `hackathon:orchestrator` agent from the `hackathon` plugin (`~/.claude/skills/hackathon`). Run `/hackathon:mode` once per event to start tracking.

## Overrides to global rules
- No TDD and no coverage targets. Done means `npm run verify` is green, the demo path works in a real browser, and critical demo steps have a smoke test if time allows.
- `docs/SPEC.md` is the plan. Don't create other planning docs. Don't run ECC plan/tdd/orch/multi/santa/gan pipelines.
- Reviews flag only correctness or security issues that could break the demo or leak data.

## Stack
- **Next.js 16** App Router under `src/`, with TypeScript and Tailwind v4. Read `node_modules/next/dist/docs/` before writing Next-specific code.
- **shadcn/ui:** add components with `npx shadcn@latest add <name>`. `cn` comes from `@/lib/utils`.
- **Neon Postgres** (NOT Supabase) via `@neondatabase/serverless`, raw SQL in `src/lib/db.ts` / `src/lib/repo.ts`. Schema: `db/schema.sql` (`npm run db:migrate`). `DATABASE_URL` comes from the Vercel Neon integration (`vercel env pull`).
- **AI:** AI SDK (`ai`) through **Vercel AI Gateway** (`src/lib/ai.ts`), models `MODEL_SMART` / `MODEL_FAST`. Auth is OIDC on Vercel; locally `vercel env pull`.
- **Durable runs:** Vercel Workflow DevKit (`workflow`), workflows in `src/workflows/`.
- **Deploy:** Vercel (team `agents`), cron in `vercel.json`.

## Two-person lanes (see docs/SPEC.md §6)
- Backend lane owns `src/lib/**` (except `mock.ts`, `api-client.ts`), `src/app/api/**`, `src/app/f/**`, `src/app/demo/**`, `src/workflows/**`, `db/**`, `scripts/**`.
- UI lane owns `src/app/(dashboard)/**`, `src/app/page.tsx`, `layout.tsx`, `globals.css`, `src/components/**`, `src/lib/mock.ts`, `src/lib/api-client.ts`.
- Contract files `src/lib/types.ts`, `src/lib/spec.ts`, `docs/API.md` change only through the backend lane. UI codes against `src/lib/mock.ts` until the API is live.

## Commands
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run verify` | Typecheck + lint + build. **Must pass before every commit and deploy.** |
| `npm run preflight` | Readiness check: env, Vercel link, verify |
| `hack status` / `hack gate <id>` / `hack next` | Hackathon stage tracking (plugin CLI) |
| `npm run db:migrate` | Apply `db/schema.sql` to DATABASE_URL (idempotent) |
| `npm run db:seed` | Seed the demo agents |
| `vercel deploy` / `vercel deploy --prod` | Preview / production deploy |

## Conventions
- Server-only secrets never get the `NEXT_PUBLIC_` prefix. Never create DB or AI clients at module top level.
- API routes validate request bodies and return `{ error }` with the right status code.
- `DEMO_MODE=true` serves seeded data and canned AI replies from `src/lib/demo.ts`. Every AI feature needs a canned path.
- Commits are small (`feat:` / `fix:` / `chore:`), one after each green slice.

## State (lives in files, not in chat)
- `.hackathon/state.json`: stage, deadline, gates and prod URL. Change it **only** through the `hack` CLI (`hack status`, `hack gate <id>`, `hack next`). The status line and the hooks read it.
- `docs/STATUS.md`: narrative (done, in progress, next, blockers, what's stubbed). Update it after every slice.
- `docs/IDEA.md`, then `docs/SPEC.md`, then `docs/API.md` (the frozen contract), then `docs/PITCH.md`.

## Do NOT
- Force-push, drop remote tables, commit `.env*` files, or deploy with a red `verify`.
- Add libraries without a reason recorded in SPEC.md, or build features that aren't in the demo script.
