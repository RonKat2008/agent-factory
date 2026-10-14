// Plain-English glossary for every piece of jargon in the dashboard.
// Rendered by <Term id="…"> (src/components/explain/term.tsx). Keep `plain` to one or two
// short sentences a non-engineer understands, and `why` to one line about why they should care.

export type GlossaryEntry = {
  /** Display name used in the popover heading. */
  term: string;
  /** What it means, in plain English. */
  plain: string;
  /** One line: why it matters to you. */
  why: string;
};

export const GLOSSARY = {
  agent: {
    term: "Agent",
    plain: "A small worker that does one recurring job for you, like checking a website and posting a summary to Slack.",
    why: "You describe the job once; the agent does it every time, on its own.",
  },
  health: {
    term: "Health",
    plain: "A score from 0 to 100: the share of the agent's last 20 runs that worked.",
    why: "Below 100 means something went wrong recently. Check the latest runs.",
  },
  version: {
    term: "Version",
    plain: "A saved copy of the agent's instructions. Every edit or automatic fix creates a new version (v1, v2, …).",
    why: "You can see exactly what changed between versions, and nothing changes silently.",
  },
  run: {
    term: "Run",
    plain: "One time the agent did its job from start to finish.",
    why: "Each run is recorded step by step, so you can see what it fetched and what it sent.",
  },
  "dry-run": {
    term: "Test run",
    plain: "A practice run on real data that doesn't send anything to anyone.",
    why: "The factory checks the agent works before it is ever allowed to post for real.",
  },
  tests: {
    term: "Tests",
    plain: "Automatic checks on a run's result, such as \"cites its sources\" or \"posts at most 5 items\".",
    why: "An agent only goes live, and a fix only ships, when all its tests pass.",
  },
  repair: {
    term: "Auto-repair",
    plain: "When a run breaks (say a website moved a page), the factory finds the cause, patches the agent and re-tests it, with no human needed.",
    why: "Your agents keep working while you're away, and you get a note explaining the fix.",
  },
  "regression-test": {
    term: "Regression test",
    plain: "A new test the factory adds after a repair, checking for the exact failure it just fixed.",
    why: "The same problem can't sneak back in a later version.",
  },
  chain: {
    term: "Chain",
    plain: "A link between two agents: when one finishes with something new, it triggers the next one.",
    why: "Small agents can be combined into a bigger workflow without writing code.",
  },
  trigger: {
    term: "Trigger",
    plain: "What starts a run: the schedule, the Run now button, or another agent in a chain.",
    why: "Tells you why a run happened when you didn't start it yourself.",
  },
  connector: {
    term: "Connection",
    plain: "Access to an outside app or data source (Slack, GitHub, a web API) that agents can read from or post to.",
    why: "Agents can only use the apps you've connected.",
  },
  outbox: {
    term: "Outbox",
    plain: "Every message your agents have sent or are waiting to send, in one place.",
    why: "See everything that went out, and approve anything that's on hold.",
  },
  "held-post": {
    term: "Held post",
    plain: "A message the agent wrote but did not send, because it needs your approval first.",
    why: "Nothing goes out until you say so.",
  },
  approval: {
    term: "Approval",
    plain: "An optional setting: the agent asks you before sending each message.",
    why: "Turn it on while you're still getting to trust a new agent.",
  },
  spec: {
    term: "Recipe",
    plain: "The agent's instructions, written as a list of ready-made building blocks (fetch a page, summarise, filter, send to Slack) rather than code.",
    why: "Every change is a readable diff, so you can always see what the agent will do.",
  },
  blocks: {
    term: "Blocks",
    plain: "The ready-made, pre-tested steps an agent is assembled from: fetch a page, read a feed, summarise with AI, filter, send to Slack.",
    why: "Agents are built from parts that are known to work, not freshly written code.",
  },
  schedule: {
    term: "Schedule",
    plain: "How often the agent runs, like \"every weekday at 9am\" or \"every 15 minutes\".",
    why: "Set it once; the agent runs on time without you.",
  },
  cron: {
    term: "Cron",
    plain: "The compact code computers use to write a schedule (\"0 9 * * 1-5\" means weekdays at 9am). We show it in plain English next to it.",
    why: "You never need to write one; describe the timing in words.",
  },
  knowledge: {
    term: "Knowledge",
    plain: "Facts your agents have picked up while working: companies, products, people, releases. Shared by the whole team of agents.",
    why: "Agents remember context from earlier runs instead of starting from zero each time.",
  },
  entities: {
    term: "Entities",
    plain: "The specific things in the knowledge graph: a company, a product, a person, a release.",
    why: "Click one to see which agents mention it and when.",
  },
  "fleet-ops": {
    term: "Ask Ops",
    plain: "A chat assistant that knows about all your agents. Ask \"what broke today?\" or \"which agent costs the most?\".",
    why: "Get answers about your agents without digging through pages.",
  },
  fleet: {
    term: "My agents",
    plain: "All the agents you've built, with how each one is doing right now.",
    why: "One glance tells you whether everything is working.",
  },
  cost: {
    term: "Cost",
    plain: "What the AI and data calls behind the agent's runs have cost so far, in US dollars.",
    why: "Most agents cost fractions of a cent per run. Watch for surprises here.",
  },
  useful: {
    term: "Useful rate",
    plain: "The share of the agent's messages that people marked 👍 rather than 👎 in Slack.",
    why: "A 👎 turns into a suggested improvement you can accept.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryId = keyof typeof GLOSSARY;

export function isGlossaryId(id: string): id is GlossaryId {
  return Object.prototype.hasOwnProperty.call(GLOSSARY, id);
}

export function glossary(id: GlossaryId): GlossaryEntry {
  return GLOSSARY[id];
}
