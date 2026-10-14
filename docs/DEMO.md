# Demo script (3:00)

Presenter: Ronit. Persona: Maya, ops lead at a 10-person startup. Have these tabs open: My agents (home), Tour, Slack (the demo channel), and the Outbox. Before starting: Tour -> Reset, and confirm the Competitor watcher and Competitor deep-dive both show as live.

## 0:00 Hook
Say: "Maya runs ops at a 10-person startup. She has recurring jobs nobody has time for, and automations that break silently. Every agent builder helps her make version one. Nobody takes responsibility for version two hundred."
Screen: the home page.

## 0:20 My agents
Click: My agents.
Say: "This fleet has been working since lunch. Each agent shows health, last output, a run strip, and cost. A run is about three hundredths of a cent."
Point at: the activity feed and the repairs counter.

## 0:45 Tour: break, repair, diff
Click: Tour -> Break. Then run the Competitor watcher.
Say: "Acme just redesigned. The changelog URL now returns 404."
Watch the repair steps: broke, repairing, tests passed, v2 live (about 8 seconds).
Click: View diff on the new version.
Say: "The URL changed and one test was added. Every failure becomes a test, so this exact break cannot ship twice. Nobody got paged."
Show the Slack message ("I fixed X because Y") if it is posted.

## 1:30 Publish, chain, deep-dive
Click: Tour -> Publish.
Say: "Acme ships a new release. The watcher sees it and posts, but only because its tests passed."
Show: the watcher's post in Slack or the Outbox. Then the Competitor deep-dive run starting.
Say: "That post triggered a second agent. The deep-dive researches the release with Exa."
Show: the deep-dive analysis in the Outbox.

## 2:00 Graph
Click: Graph (Flow view).
Say: "Agents trigger agents. Here is the watcher feeding the deep-dive." Flip to Knowledge for two seconds: "Entities from every post build a fleet knowledge graph that agents can recall."

## 2:15 Build from one sentence
Click: Home. Type "Every weekday at 9, post Hacker News stories about AI agents with real discussion." Continue to the plan step.
Say: "A plan card and a Slack preview before anything runs." Click "Send me a test now" and show it land. Click Go live.
Say: "It does not ship until the tests pass. Anyone can sign in with Slack and get this in their own channel."

## 2:40 Ask Ops
Press Cmd+K. Ask: "why did the watcher break?"
Say: "That is the eve Fleet Ops agent. It reads run history, and anything that changes the fleet asks for approval."

## 2:50 Close
Say: "Other tools help you build an agent. Ours takes responsibility for keeping it working. Built on Vercel Workflow, AI Gateway, Sandbox, eve, and Neon."

## If something fails
- **AI or gateway is slow or down:** set `DEMO_MODE=true` in Vercel env and redeploy (or run locally with it). Repair and builds use canned replies.
- **Slack does not post:** open the Outbox. Every message is recorded there with its feedback links. Say so and continue.
- **Repair does not finish in 15 seconds:** Tour -> Reset, then Break and run again once. If it fails again, switch to DEMO_MODE.
- **Chain does not fire:** open the Competitor deep-dive and click Run now, then show the Graph flow view.
- **Ask Ops does not respond:** skip it and go to the close; the Fleet Ops health check is at https://agent-factory-ops.vercel.app/eve/v1/health.
- **Anything else:** play the backup video (recorded by the teammate at 15:15).
