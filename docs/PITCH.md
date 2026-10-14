# Agent Factory: Devpost submission text

**Name:** Agent Factory

**Tagline:** Other tools help you build an agent. Ours takes responsibility for keeping it working.

**Track:** Agents & Factories

## Description (about 150 words)

Agent Factory turns one sentence into a recurring agent that stays working. You describe a job, such as "every weekday, tell #product what our competitors shipped". The factory plans it, assembles it from a fixed library of tested blocks, dry-runs it against real sources, writes tests, and ships it only if the tests pass. It then runs on a schedule and posts to Slack.

The difference is what happens next. When a source changes and a run breaks, the factory diagnoses the failure, patches the spec, re-tests, and promotes a new version, adding a regression test for the exact failure so it cannot ship twice. It tells you in Slack what it fixed and why, with a diff. Thumbs-down on a post, or an English instruction like "only posts with 100+ points", becomes a proposed edit that is re-tested before it replaces the old version. Agents are JSON specs, not generated code, so every change is a reviewable diff.

## How we built it

Agents are Zod-validated JSON specs: a cron schedule, ordered steps drawn from nine blocks (fetch_url, fetch_rss, hn_search, github_issues, llm, filter, diff_with_memory, send_slack, require_approval), and a test list with six test kinds. The runtime resolves templates between steps and records every step's input and output in Neon Postgres, which is what makes repair possible: blocks never throw, they return recorded errors. Three Vercel Workflow DevKit workflows make the loop durable: `runAgent` (triggered by a per-minute Vercel Cron tick), `buildAgent` (spec, dry run, tests, up to three revise loops), and `repairAgent` (diagnose, patch, re-test, new version plus regression test). Model calls go through the AI SDK and Vercel AI Gateway: Claude Sonnet 5.5 builds and repairs, Claude Haiku 5.5 runs cheap steps and judges outputs. A link-candidate heuristic gives the repair model verified URLs instead of letting it guess. The dashboard is Next.js 16: fleet, create, agent detail with version diff, and outbox. Every AI call has a canned `DEMO_MODE` path so the demo survives a bad network.

## Challenges

- **Making failure legible.** Repair only works if the failing step's input, output, and error are captured exactly, so blocks return results instead of throwing and every step is persisted.
- **Keeping the repair model honest.** Unconstrained, it invents URLs. We pass verified link candidates and require the patched spec to pass both old and new tests before it goes live.
- **Test gating with non-deterministic output.** Deterministic tests (citations, item caps, no post when unchanged) carry most of the weight; an LLM judge covers the rest with a rubric.
- **Durable execution on a new stack.** We spiked Workflow DevKit on Next.js 16 first, with a plain sequential runner behind the same `runAgent()` signature as the fallback.
- **Time.** One day, two people, and Claude subagents working in separate lanes against a frozen API contract.

## What's next

- Per-agent Neon branches, so an agent's memory and dry runs are isolated and a bad repair can be discarded by dropping a branch.
- Vercel Connect for one-click Slack and GitHub authorization instead of pasting webhooks and tokens.
- eve export, so a proven agent can leave the factory as a standalone project.
- More blocks: email, Linear, Notion, calendar, and a generic authenticated HTTP block.

## 3-minute demo script

Presenter: Ronit. Persona: Maya, ops lead at a 10-person startup. Screens: Fleet page, Slack, agent detail.

**0:00 to 0:20, the problem**
"Maya runs ops at a 10-person startup. She has recurring jobs nobody has time for, and automations that break silently. Every agent-builder helps her build the first version. Nobody takes responsibility for version two hundred."

**0:20 to 0:50, the fleet**
"This is the fleet. Three agents have been running since about 12:30. Each has a health ring, run count, cost, and a thumbs-up rate. The header shows agents live, runs today, auto-repairs, and total spend. This feed is live activity: scheduled runs, posts, feedback."

**0:50 to 1:40, the wow: break and repair**
"Acme, a competitor we track, just redesigned their site." (Hit Break, then Run now on Competitor watcher.) "The watcher fetches their changelog and gets a 404. Watch the feed: broke, repairing. The factory found the new location, `/demo/acme/updates`, patched the spec, re-ran its tests, and v2 is live. In Slack: 'I fixed the changelog URL because the old page returns 404, and added a regression test.' Open the version diff: the URL changed, one test was added, created by factory. Nobody got paged."

**1:40 to 2:20, build live**
"Now a new job. I type: 'Every weekday at 9, post Hacker News stories about AI agents with real discussion.'" (Submit.) "The plan card says what it runs, checks, does, sends to, and asks before. Build log: dry run, a test failed, the factory fixed its own spec, tests passed. Go live. It did not ship until the tests passed."

**2:20 to 2:45, steer**
"I can steer in English: 'only posts with 100+ points.' That is a new version, re-tested before it replaces v1. I can turn on approval so a human signs off before anything posts. And when someone clicks thumbs-down on a Slack post, the factory proposes an edit to the agent. Feedback changes the agent."

**2:45 to 3:00, close**
"Other tools help you build an agent. Ours takes responsibility for keeping it working. Built on Vercel Workflows, AI Gateway, and Neon. Thank you."
