# UI overhaul: Wave 2 plan

Goal (from the user): make Agent Factory easy for someone using it for the first time. Big overhaul,
animations, and plain language everywhere.
Deadline: feature freeze at 15:15 PT. Each Wave 2 package must be committed by **14:55**.

The Wave 1 foundation is committed: the motion system, onboarding, Explain mode, and this plan.
Implement the plan as written. If something here conflicts with the live code, keep the behavior
working and do the closest thing to the plan.

---

## 0. Rules for every Wave 2 package

- **Identity stays:** the factory control room. Warm paper `#F6F4EF`, panels `#FBFAF7`, `rounded-[3px]`,
  Geist Mono for every number, time, cost, version and cron, semantic color only (emerald = good,
  red = broken, amber = repairing, violet = factory-made or "explain", sky = building). Keep using
  `src/components/ui-tokens.ts` (`LABEL`, `PANEL`, `BTN_PRIMARY`, `BTN_SECONDARY`, `FOCUS`).
- **Friendlier on beginner surfaces** (home, empty states, My agents header, Tour):
  - More whitespace: `py-10`/`gap-6` instead of `p-3`/`gap-3`.
  - Bigger primary actions: `h-11 px-5 text-[15px]`.
  - Page titles use `.t-title` (or `text-[28px] font-semibold tracking-[-0.03em]`).
  - A one-line plain-English lede under every page title (`.t-lede` / `text-stone-600 text-[15px]`).
- **One primary (dark) button per screen.** Everything else is secondary or a text button.
- **Section labels** may stay mono uppercase on data-dense panels (detail page, graph). On beginner
  surfaces use sentence-case `text-[15px] font-semibold` headings instead.
- **Plain words first, jargon second.** Wrap the remaining jargon in `<Term>` (see §3). Never put
  `<Term>` inside a `<button>` or `<a>`: it is focusable itself. Put it next to the control.
- **Motion:** import only from `@/components/motion` (barrel) or its files. Never hard-code
  durations or springs; use `DURATION`, `EASE`, `SPRING` and `STAGGER` from `motion/tokens.ts`.
  Animate only opacity and transform. One orchestrated moment per screen; no fade-up on every
  section.
- **Process:** touch only your package's files (§6). Run `npx tsc --noEmit -p .` and
  `npx eslint <your files>`. Don't run `next dev` or `next build`. Commit only your paths:
  `git add <paths>` then `git commit -- <paths>`. Don't push, don't stash, and don't dispatch
  subagents.

---

## 1. Wave 1 foundation (what you can use)

### Motion: `src/components/motion/`

| Export | File | Use |
|---|---|---|
| `DURATION`, `EASE`, `SPRING`, `STAGGER`, `DISTANCE`, `TONE` | `tokens.ts` | All timing values |
| `MotionProvider` | `motion-provider.tsx` | Already mounted in the dashboard layout (`reducedMotion="user"`) |
| `PageTransition` | `page-transition.tsx` | Already mounted around every page; enter-only fade and rise on route change |
| `<FadeIn delay y as>` | `fade-in.tsx` | One-shot entrance for a hero block |
| `<Stagger as gap delay>` + `<StaggerItem as>` | `fade-in.tsx` | Groups entering in sequence: home "how it works" cards, plan rows, checklist |
| `<NumberTicker value format from>` | `number-ticker.tsx` | Springs to a new number. Replaces `fleet/count-up.tsx` usages |
| `<StatusMorph status size="sm"\|"md">` | `status-morph.tsx` | Drop-in replacement for `<StatusPill>`. The label crossfades, a ring pulses in the new color, and broken/repairing → live gets an emerald burst plus a check tick. Plain labels: repairing = "Fixing itself", ready = "Ready to go live" |
| `<LayoutList items getKey renderItem as enterFrom itemClassName>` | `layout-list.tsx` | Feeds and boards: new rows slide in, removed rows fade, reordered rows glide. Rows present on mount don't animate. Max ~40 rows |
| `<Pulse trigger tone radius>` | `pulse.tsx` | A one-shot ring around a child whenever `trigger` changes (an event id or a counter). The initial value never fires |
| `useIsHydrating()` | `use-hydrating.ts` | True during SSR and hydration. Use it to skip entrance animation on server-painted content |

### Onboarding: `src/components/onboarding/`

`OnboardingOverlay` is mounted in the layout. It runs on the first visit (`localStorage.af_onboarded`)
or when `replayIntro()` is called. It dims the page, moves an animated spotlight to each target and
shows a caption card (Back / Next / Skip intro; Esc, ← and → work). Steps whose target isn't on the
current page are skipped. **Targets are `data-tour="<id>"` attributes, which Wave 2 must add:**

| Step | Caption | `data-tour` (the first visible one wins) | Package |
|---|---|---|---|
| 1 | Describe a job in one sentence | `home-input` (the home textarea's wrapper) | P1 |
| 2 | The factory builds it and tests it before it ever runs | `how-build` (home "how it works" card 2), fallback `build-log` (the create page's build checklist) | P1 |
| 3 | It runs on schedule — here's what it sends you | `how-run` (home card 3), fallback `nav-agents` | P1 |
| 4 | If it breaks, it fixes itself — try it in the Tour | `nav-tour` (the Tour link in the top bar), fallback `how-repair` | P1 |

Also exported: `replayIntro()`, `hasOnboarded()`, `<ReplayIntroButton>` (a text button, for empty
states: "Show me around").

### Explain mode: `src/components/explain/` and `src/lib/glossary.ts`

- `<Term id="health">Health</Term>` renders a dotted underline. Hover, focus or tap opens an animated
  popover (in a portal, so it escapes `overflow-hidden`) with the plain meaning and "Why it matters".
  With no children it shows the glossary's display name.
- Glossary ids: `agent health version run dry-run tests repair regression-test chain trigger connector
  outbox held-post approval spec blocks schedule cron knowledge entities fleet-ops fleet cost useful`.
- `<ExplainToggle withLabel?>` is the "?" switch. When it's on, every Term glows violet. The setting is
  persisted (`localStorage.af_explain`). Shortcut: `?`.
- `<HelpMenu>` is the top-bar dropdown: Replay intro, Explain mode switch, Take the 60-second tour,
  and Keyboard shortcuts. Its dialog lists `?` = Explain mode, `g h` = Home, `g a` = My agents,
  `g t` = Tour, Esc. **Mounting `<HelpMenu>` also installs these shortcuts, so mount it exactly once
  (P1, in the top bar).**
- The state lives in a module store, so no provider is needed. `useExplainMode()`,
  `toggleExplainMode()` and `setExplainMode()` are exported.

---

## 2. Information architecture and nav

```
[glyph] AGENT FACTORY   Home   My agents   Tour•   More ▾        [Ask Ops]  [? Help]   ● 3 live
                                                     ├ Graph       (knowledge + chains map)
                                                     ├ Outbox      (everything your agents sent)
                                                     └ Connections (apps your agents can use)
```

- Routes: Home = `/` (build an agent), My agents = `/fleet`, Tour = `/tour`, Graph = `/graph`,
  Outbox = `/outbox`, Connections = `/connections`. Agent detail stays at `/agents/[id]`, and its
  breadcrumb reads "← My agents". `/new` stays reachable from deep links but isn't in the nav.
- The **Tour** link keeps its violet dot until the user has visited `/tour`
  (`localStorage.af_tour_seen`, wrapped in try/catch).
- **More ▾** is a small menu built the same way as HelpMenu's dropdown (`SPRING.snappy`, scale
  0.97 → 1, origin top-right). Each item has a one-line description in `text-[11px] text-stone-500`.
  When the current route is one of its items, the More button shows the active style and the item's
  name, e.g. "Outbox ▾".
- Right side: `<AskOps />` (keep it as it is), then `<HelpMenu />`, then the live indicator,
  simplified to "● 3 live", with `<NumberTicker>` on the count. **Remove "cron ● every minute" and the
  clock** from the bar: it's jargon for a newcomer. Move them into the Help menu footer, or drop them.
- Active-tab indicator: a shared `motion.span layoutId="nav-active"` behind the active link, so the
  dark pill glides between tabs (`SPRING.snappy`).
- Mobile (<640px): Home, My agents, Tour and More stay; Ask Ops and Help collapse to icon buttons.
  No horizontal page scroll at 375px.

---

## 3. Plain-language relabeling

| Where | Current | New | Term wrap |
|---|---|---|---|
| Nav | Fleet | My agents | — |
| Nav | New agent | (removed; Home is the builder) | — |
| Nav | Graph / Outbox / Connections | under "More ▾" with the same names | — |
| Nav right | cron ● every minute · clock | (removed) | — |
| Home title | (new) | "What should your agent do?" | — |
| Home button | Build / Create | "Build my agent" | — |
| Create stepper | Plan / Build / Test / Go live (or similar) | "Plan → Build → Test run → Go live" | `dry-run` on "Test run" |
| Create build log | dry run / test failed / self-fixed / tests passed | "Test run on real data" / "A check failed" / "Fixed it automatically" / "All checks passed" | `tests` on "checks" |
| Create plan card | Runs / Checks / Does / Sends to / Asks before | "When it runs" / "What it checks" / "What it does" / "Where it posts" / "Asks you before" | `schedule`, `tests`, `approval` |
| Create CTA | Go live | "Turn it on" (toast: "Your agent is on") | — |
| My agents title | Fleet | "My agents" + lede "Everything you've built, and whether it's working right now." | — |
| My agents stats | Agents live / Runs today / Repaired automatically / Total cost | "Working now" / "Jobs done today" / "Fixed themselves" / "Spent so far" | `run` on "Jobs", `repair` on "Fixed themselves", `cost` |
| Agent row | Last run / Next run / Success / Cost / Useful / Runs | "Last ran" / "Next" / "Worked" / "Cost" / "👍 rate" / "Runs" | `useful` on "👍 rate", `health` on the ring's tooltip |
| Agent row | `v1` chip | `v1` (keep, mono) | `version` |
| Agent row | "2 repairs" | "Fixed itself 2×" | `repair` |
| Agent row button | RUN NOW | "Run now" (sentence case) | — |
| Activity feed | Activity | "What's happening" | — |
| Status pill | Repairing / Ready | "Fixing itself" / "Ready to go live" (StatusMorph does this) | — |
| Detail stats | Schedule / Health / Cost / Runs / Repairs | "Runs" (schedule) / "Health" / "Cost" / "Jobs done" / "Fixed itself" | `schedule`, `health`, `cost`, `run`, `repair` |
| Detail | Version history | "Changes over time" | `version` |
| Detail | Tests added in this version | "Checks added in this change" | `regression-test` |
| Detail | diff vs v1 | "What changed" | `spec` |
| Detail | Edit in plain English / Steer this agent | "Change what it does" + placeholder "e.g. Only include posts with 100+ points" | — |
| Detail | Apply edit | "Test and apply" | — |
| Detail | Require approval before sending | "Ask me before it posts" | `approval` |
| Detail | Events | "Recent activity" | — |
| Detail | Run timeline / Step trace / Output / Test results | "This run, step by step" / "Steps" / "What it sent" / "Checks" | `run`, `tests` |
| Detail | Export as eve agent | keep, but move it into a "⋯" overflow | — |
| Outbox | Outbox | title "Outbox" + lede "Every message your agents sent, and the ones waiting for your OK." | `outbox` on the title, `held-post` on "held" |
| Outbox | approve / reject | "Send it" / "Don't send" | — |
| Connections | Connections | lede "Apps and data your agents can use." | `connector` |
| Connections | Connected · env | "Connected (built in)" | — |
| Graph | Graph | title "Agent map" + lede "How your agents feed each other, and what they've learned." | `chain`, `knowledge`, `entities` in the legend |
| Tour | The 60-second tour | keep, with step titles "1. Meet the agent" / "2. Break it, watch it fix itself" / "3. See it work again" | `repair`, `regression-test` |
| Ask Ops | Ask Ops | keep; its empty-state hint reads "Ask anything about your agents — 'what broke today?'" | `fleet-ops` |

---

## 4. Per-page changes

### P1. Top bar: `src/components/fleet/top-bar.tsx`
- Apply §2 (nav, More ▾, `layoutId` pill, HelpMenu, simplified live count with NumberTicker).
- Add `data-tour="nav-tour"` to the Tour link and `data-tour="nav-agents"` to the My agents link.
- Keep `bar-shimmer` while any agent is working.

### P1. Home (builder): `src/app/(dashboard)/page.tsx`, `src/components/home/**`, `src/components/create/**`
Layout (beginner surface, more whitespace, centered column `max-w-[760px]`, left-aligned text):
```
  What should your agent do?                         ← t-title, FadeIn
  Describe a recurring job in one sentence. We build it, test it, and keep it working.
  ┌──────────────────────────────────────────────┐  data-tour="home-input"
  │ Every weekday at 9, tell #product what …     │  textarea text-[16px] min-h-[96px]
  └──────────────────────────────────────────────┘
  [ Build my agent ]  (h-11, primary)   Try an example: [Competitor watch] [HN digest] [Release notes]
                                                      (chips; clicking fills the textarea, Pulse on fill)

  How it works                                        ← Stagger gap="loose", 3 StaggerItems in a row (stack on mobile)
  ┌ 1 You describe it ┐ ┌ 2 It's built and tested ┐ ┌ 3 It runs and reports ┐
  │ (inline SVG)      │ │ data-tour="how-build"    │ │ data-tour="how-run"    │
  └───────────────────┘ └──────────────────────────┘ └────────────────────────┘
  If it breaks, it fixes itself. Watch it happen → /tour   (data-tour="how-repair", violet text link)
```
- These cards are a real sequence, so the numbers are justified. Each has a small inline SVG
  (stroke `stone-700`, accent violet, 40×40): a speech line, a checklist with a tick, a clock with
  a paper plane. Wrap `Term id="dry-run"` ("test run") and `Term id="schedule"` in the card copy.
- If the user already has agents, show a quiet strip under the input: "You have 3 agents working →
  My agents".
- **Hero moment 1, building an agent** (see §5.1) lives in `src/components/create/build-log.tsx`
  and the plan and preview steps. Give the build checklist container `data-tour="build-log"`.
- Plan card rows: `<Stagger>` + `<StaggerItem>` with the relabels from §3.
- After "Turn it on": `<StatusMorph>` ready → live, then the CTA "See it in My agents" (primary) and
  "Build another" (secondary).

### P2. My agents: `src/app/(dashboard)/fleet/page.tsx`, `src/components/fleet/**` (except `top-bar.tsx`)
- Header: title "My agents" plus a lede. The stat strip keeps its design; swap `CountUp` for
  `NumberTicker` and apply the §3 labels with Terms. "Fixed themselves" stays violet. When
  `autoRepairs` increases, `<Pulse tone="violet" trigger={autoRepairs}>` fires on that tile.
- Agent list (`fleet-board.tsx`): render rows through `<LayoutList enterFrom="top">`, keyed by
  agent id, so a newly built agent slides in and status changes don't jump. On first mount,
  wrap the list in `<Stagger gap="tight">` instead (LayoutList doesn't animate initial rows).
  Use whichever is simpler; don't nest them.
- `agent-row.tsx`: `<StatusPill>` → `<StatusMorph>`. When the row's `status` changes to `broken`,
  wrap the row in `<Pulse tone="red">`; when it goes back to `live` after trouble, StatusMorph does
  the emerald burst. Health ring: number → `NumberTicker`. "Run now" button: on click,
  `whileTap={{ scale: 0.97 }}`.
- Activity feed (`src/components/feed/activity-feed.tsx`; P2 owns it): render through
  `<LayoutList enterFrom="top">`, and drop the `feed-row-enter` class. Repair events (`repaired`)
  get a violet left rule that's already there, plus `<Pulse tone="violet" trigger={e.id}>` on the
  icon. Retitle it "What's happening".
- **Empty state** (no agents): a centered panel with an inline SVG (an empty conveyor belt: a
  rounded rect with 3 dashed boxes and a violet spark), the heading "No agents yet", the body
  "Describe a job in one sentence and the factory builds it for you.", a primary "Build your first
  agent" (→ `/`) and a secondary `<ReplayIntroButton>Show me around</ReplayIntroButton>`.
- Tour banner (`tour-banner.tsx`): restyle as a friendly callout: "New here? Watch an agent break
  and fix itself in 60 seconds → Take the tour". Keep the dismiss button.
- Factory floor charts: keep them, collapsed by default behind "Show charts" (the beginner sees
  less). Expanding is an opacity/scaleY accordion (`SPRING.gentle`, transform-origin top).

### P2. Agent detail: `src/app/(dashboard)/agents/[id]/page.tsx`, `src/components/agent/**`
- `agent-header.tsx`: `<StatusMorph size="md">`. Stats use §3 labels with Terms, and Health and
  Cost use `NumberTicker`. Add a one-line plain summary under the title: the agent's `request` in
  quotes (it's already there; make it `text-[15px] text-stone-700`). The primary action is **Run now**.
  Pause and Export go into secondary and overflow.
- `version-history.tsx`: rename it (§3). Each version entry is a `StaggerItem`. A factory-made
  version (repair) gets a violet "Fixed automatically" chip, with `Term id="repair"`. The "What
  changed" diff expands with an opacity/scaleY accordion. Added test lines get
  `Term id="regression-test"` in the "Checks added" label.
- `run-timeline.tsx` / `run-strip.tsx`: the run strip cells get `whileHover={{ y: -2 }}`. The
  selected run's step list goes through `<Stagger gap="tight">`.
- `steering-panel.tsx`: the "Change what it does" textarea is larger (`min-h-[88px]`, `text-[15px]`),
  with "Test and apply" as a secondary button that becomes primary once there's text. A proposed
  version appears with `FadeIn` and a `Pulse tone="violet"`. The approval toggle label reads
  "Ask me before it posts" with `Term id="approval"`.
- `agent-events.tsx`: render through `LayoutList`.
- **Hero moment 2, repair** (§5.2) also applies here when the status flips live.

### P3. Tour: `src/app/(dashboard)/tour/page.tsx`, `src/components/tour/**`
- Hero: the title stays "The 60-second tour", with the lede "Watch an agent break, fix itself, and
  get back to work. No setup needed." Step headers get the §3 titles. Each step panel is a
  `StaggerItem` on first load.
- `repair-timeline.tsx`: **hero moment 2** (§5.2). Render the rows through
  `<LayoutList enterFrom="bottom">` and remove `feed-row-enter`. Put `<StatusMorph>` beside the
  timeline title, driven by the agent's status.
- "Fixed in 8s, no human involved" panel: `NumberTicker` on the seconds, and a celebratory
  entrance (§5.2 finish). Wrap `Term id="repair"` on "Fixed" and `Term id="regression-test"` in the
  Slack message description.
- After the user completes the tour, set `localStorage.af_tour_seen = "1"` (try/catch). P1's nav
  reads it.

### P3. Graph: `src/app/(dashboard)/graph/page.tsx`, `src/components/graph/**`
- Retitle it "Agent map", with the lede from §3. Legend entries get Terms (`chain`, `knowledge`,
  `entities`, `connector`).
- **Hero moment 3, a chain firing** (§5.3): when a `triggered` event arrives, animate the edge.
- Empty state: an inline SVG of two nodes and a dashed edge, "Agents that feed each other show up
  here. Build two agents and link them.", with the CTA "Build an agent" (→ `/`).

### P3. Outbox: `src/app/(dashboard)/outbox/page.tsx`, `src/components/outbox/**`
- Title with `Term id="outbox"`, the lede from §3, and "held" rows labeled "Waiting for your OK"
  with `Term id="held-post"`. "Send it" is the primary button only on held rows.
- List through `LayoutList`. When a held post is sent, the row's status chip uses `Pulse tone="emerald"`.
- Empty state: an inline SVG of an empty tray, "Nothing sent yet. When your agents post, every
  message shows up here.", with the CTA "See my agents".

### P3. Connections: `src/app/(dashboard)/connections/**`, `src/components/connections/**`
- The lede from §3, with `Term id="connector"`. The "Connected · env" pill is relabeled. Cards
  enter with `Stagger`. A successful test call gives `Pulse tone="emerald"` on the pill.
- Empty or not-connected cards: the friendly line "Connect once, and any agent can use it."

### P3. Ask Ops panel touch-ups: `src/components/ops/**` (visual polish only; don't change the data flow)
- The panel opens with `SPRING.gentle` (x from 24 → 0, opacity). Messages render through
  `LayoutList enterFrom="bottom"`. The empty state shows 3 suggestion chips ("What broke today?",
  "Which agent costs the most?", "What did my agents learn about Acme?"). Coordinate with the Ask
  Ops owner if they're still active: **touch only className/motion wrappers**.

---

## 5. Motion choreography for the three hero moments

### 5.1 A new agent being built (`create/build-log.tsx`, `plan-step.tsx`, `preview-step.tsx`)
1. Submitting the textarea: the button shows a spinner and the label "Planning…". The textarea
   fades to 60% opacity.
2. The plan card enters with `FadeIn` (y = `DISTANCE.md`). Its 5 rows use
   `Stagger gap="normal"` + `StaggerItem`.
3. The build checklist (`data-tour="build-log"`): each step is a row with an icon slot.
   - Pending: a stone circle outline. Running: an amber spinner. Done: an emerald circle that
     scales 0.6 → 1 with `SPRING.bouncy`, plus an SVG tick drawn with `pathLength 0 → 1`
     (`DURATION.normal`).
   - A failed check: the row turns red with a single `Pulse tone="red"`. The next row, "Fixed it
     automatically", enters in violet with `Pulse tone="violet"`.
   - Rows are appended through `LayoutList enterFrom="bottom"`.
4. All checks pass: a footer bar appears with "All checks passed — ready to turn on" (emerald).
   The "Turn it on" primary button gets `Pulse tone="emerald"` once.
5. Turned on: `StatusMorph` ready → live, then the CTA swap with `FadeIn`.

### 5.2 A repair (`tour/repair-timeline.tsx`, `tour-panel.tsx`, `fleet/agent-row.tsx`, `agent/agent-header.tsx`)
1. **Break:** the agent's `StatusMorph` goes live → broken (red ring). The first timeline row slides
   up from the bottom with a red icon.
2. **Repairing:** the status goes to "Fixing itself" (amber ring, its dot pings). Each new event row
   enters through `LayoutList enterFrom="bottom"`, one at a time as the API delivers them. The
   connector line between rows grows with `scaleY 0 → 1` (origin top, `DURATION.normal`) and must
   be a transform, not a height change.
3. **Tests pass:** the row's shield icon gets `Pulse tone="emerald"`.
4. **Live again:** `StatusMorph` repairing → live gives the **emerald burst and check tick**, which
   is the payoff.
5. **Finish panel** ("Fixed in Ns, no human involved"): it enters with `SPRING.gentle` (y 16 → 0,
   scale 0.98 → 1), and the seconds count up with `NumberTicker from={0}`. Then the Slack card
   slides in (`FadeIn delay={DURATION.normal}`). It's tasteful: no confetti, just one violet
   radial glow behind the panel fading 0.5 → 0 over `DURATION.crawl` (opacity only).
6. Reduced motion: every transform is dropped automatically (MotionProvider). Opacity changes
   remain.

### 5.3 A chain firing (`graph/graph-canvas.tsx` + `draw.ts`, the fleet feed)
1. When a `triggered` FeedEvent arrives (`data.fromAgentId` → `data.toAgentId`), the edge from upstream to
   downstream in the graph draws a traveling violet dot along the edge over `DURATION.slow`
   (canvas: interpolate the position each frame). The downstream node gets a single expanding
   ring (canvas circle; radius and alpha over `DURATION.slow`).
2. In the activity feed, a `triggered` row shows "⛓ Triggered by <upstream>" with
   `Term id="chain"`, plus a `Pulse tone="violet"` on the downstream agent's row on My agents.
3. `chain_skipped`: a grey row, no pulse.

---

## 6. Work packages (parallel, non-overlapping)

| Package | Owns (only these files) | Deliverables |
|---|---|---|
| **P1: nav, home and create** | `src/components/fleet/top-bar.tsx`, `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/new/**`, `src/components/home/**`, `src/components/create/**` | §2 nav (More ▾, HelpMenu, layoutId pill, simplified live count); home layout + how-it-works + example chips; all P1 `data-tour` ids (`home-input`, `how-build`, `how-run`, `how-repair`, `build-log`, `nav-tour`, `nav-agents`); hero moment 5.1; §3 relabels for nav/home/create |
| **P2: My agents and agent detail** | `src/app/(dashboard)/fleet/**`, `src/components/fleet/**` **except** `top-bar.tsx`, `src/components/feed/**`, `src/app/(dashboard)/agents/**`, `src/components/agent/**` | StatusMorph and NumberTicker swaps; LayoutList for rows, feed and events; empty state; tour banner; collapsed charts; detail relabels and Terms; repair finish on rows and the header (5.2 steps 1, 2 and 4) |
| **P3: Tour, Graph, Outbox, Connections and Ops touch-ups** | `src/app/(dashboard)/tour/**`, `src/components/tour/**`, `src/app/(dashboard)/graph/**`, `src/components/graph/**`, `src/app/(dashboard)/outbox/**`, `src/components/outbox/**`, `src/app/(dashboard)/connections/**`, `src/components/connections/**`, `src/components/ops/**` (className/motion only) | Hero moments 5.2 (tour) and 5.3 (graph); relabels and Terms; empty states with SVGs; `af_tour_seen` flag; Ask Ops panel polish |

Shared and read-only for Wave 2: `src/components/motion/**`, `src/components/onboarding/**`,
`src/components/explain/**`, `src/lib/glossary.ts`, `src/components/ui-tokens.ts`,
`src/components/status-pill.tsx`, `src/components/event-style.ts`, `src/app/(dashboard)/layout.tsx`,
`src/app/globals.css`. If you need a new glossary term or motion primitive, define it locally in your
package and mention it in your report. Don't edit the shared files.

### Done checklist (each package)
- [ ] `npx tsc --noEmit -p .` has no errors in your files; `npx eslint <your files>` is clean.
- [ ] No horizontal scroll at 375px on your pages; visible focus rings; one primary button per screen.
- [ ] Every jargon word on your pages is relabeled per §3 or wrapped in `<Term>`.
- [ ] Your `data-tour` ids are present (P1).
- [ ] Commit: `feat(ui): overhaul <package> — <summary>` with only your paths.
