// The three demo agents. APP_URL is read at call time so local seeds point at the local server.
import { AgentSpecSchema, type AgentSpec } from "@/lib/spec";

export type SeedAgent = { request: string; spec: AgentSpec };

export const SEED_NAMES = {
  brief: "Daily AI agents brief",
  watcher: "Competitor watcher: Acme",
  next: "Next.js release assistant",
  deepDive: "Competitor deep-dive",
} as const;

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function seedAgents(): SeedAgent[] {
  const raw: SeedAgent[] = [
    {
      request: "Every 30 minutes, send me the 3 most important things about AI agents from Hacker News and Simon Willison's blog, with sources.",
      spec: {
        name: SEED_NAMES.brief,
        schedule: "*/30 * * * *",
        requiresApproval: false,
        steps: [
          { id: "hn", block: "hn_search", params: { query: "AI agents", sinceHours: 48, minPoints: 10, limit: 15 } },
          { id: "blog", block: "fetch_rss", params: { url: "https://simonwillison.net/atom/everything/", limit: 10 } },
          {
            id: "top",
            block: "llm",
            params: {
              instruction: "Pick the 3 most important items about AI agents. One bullet each, cite the item URL.",
              input: "HN:\n{{steps.hn.items}}\n\nBlog:\n{{steps.blog.items}}",
              format: "cited_bullets",
            },
          },
          { id: "send", block: "send_slack", params: { message: "*Daily AI agents brief*\n{{steps.top.markdown}}", skipIfEmpty: true } },
        ],
        tests: [
          { kind: "nonempty", addedBy: "build" },
          { kind: "has_citations", addedBy: "build" },
          { kind: "max_items", config: { max: 3 }, addedBy: "build" },
          { kind: "llm_judge", config: { rubric: "Exactly 3 bullets, each about AI agents, each with a working-looking source URL." }, addedBy: "build" },
        ],
        plan: {
          runs: "Every 30 minutes",
          checks: "Hacker News (AI agents, 10+ points, last 48h) and Simon Willison's blog",
          does: "Picks the 3 most important items about AI agents and summarizes each in one cited bullet",
          sendsTo: "Slack",
          asksBefore: "Nothing",
        },
      },
    },
    {
      request: "Watch Acme's changelog and tell me in Slack whenever they ship something new.",
      spec: {
        name: SEED_NAMES.watcher,
        schedule: "*/15 * * * *",
        requiresApproval: false,
        steps: [
          { id: "page", block: "fetch_url", params: { url: `${appUrl()}/demo/acme/changelog` } },
          { id: "diff", block: "diff_with_memory", params: { input: "{{steps.page.text}}", memoryKey: "acme_changelog" } },
          {
            id: "summary",
            block: "llm",
            params: {
              instruction: "Summarize each new changelog entry in one bullet. Cite the page URL given as Source. If there are no changes return an empty list.",
              input: "Source: {{steps.page.url}}\nNew entries:\n{{steps.diff.text}}",
              format: "cited_bullets",
            },
          },
          { id: "send", block: "send_slack", params: { message: "*Acme shipped something*\n{{steps.summary.markdown}}", skipIfEmpty: true } },
        ],
        tests: [
          { kind: "has_citations", addedBy: "build" },
          { kind: "no_post_if_unchanged", addedBy: "build" },
          { kind: "llm_judge", config: { rubric: "Only mentions changes present in the source; under 120 words." }, addedBy: "build" },
        ],
        plan: {
          runs: "Every 15 minutes",
          checks: "Acme's public changelog page",
          does: "Spots entries it hasn't seen before and summarizes each in one cited bullet",
          sendsTo: "Slack",
          asksBefore: "Nothing",
        },
      },
    },
    {
      request: "Check every new Next.js release, tell me what changed and flag anything risky.",
      spec: {
        name: SEED_NAMES.next,
        schedule: "0 * * * *",
        requiresApproval: false,
        steps: [
          { id: "releases", block: "fetch_rss", params: { url: "https://github.com/vercel/next.js/releases.atom", limit: 5 } },
          { id: "diff", block: "diff_with_memory", params: { input: "{{steps.releases.items}}", memoryKey: "next_releases" } },
          {
            id: "summary",
            block: "llm",
            params: {
              instruction: "One bullet per new release: version, the most notable change, and any risk to flag (breaking changes, deprecations, security fixes) prefixed with ⚠️. Cite the release URL.",
              input: "{{steps.diff.text}}",
              format: "cited_bullets",
            },
          },
          { id: "send", block: "send_slack", params: { message: "*Next.js release check*\n{{steps.summary.markdown}}", skipIfEmpty: true } },
        ],
        tests: [
          { kind: "has_citations", addedBy: "build" },
          { kind: "no_post_if_unchanged", addedBy: "build" },
          {
            kind: "llm_judge",
            config: { rubric: "Each bullet names a release version and cites its URL; bullets that mention breaking changes, deprecations or security issues flag them with ⚠️." },
            addedBy: "build",
          },
        ],
        plan: {
          runs: "Every hour",
          checks: "GitHub releases for vercel/next.js",
          does: "Spots new releases, summarizes the most notable change in one cited bullet each, and flags risks (breaking changes, deprecations, security fixes) with ⚠️",
          sendsTo: "Slack",
          asksBefore: "Nothing",
        },
      },
    },
  ];
  return raw.map((a) => ({ ...a, spec: AgentSpecSchema.parse(a.spec) }));
}

/** Web research source for the chained deep-dive: the Exa connector when it exists, else Hacker News. */
export type ChainResearch = { kind: "exa"; connector: string; action: string } | { kind: "hn" };

/**
 * The chained demo agent: runs whenever the Competitor watcher posts, researches each Acme change on the
 * web and posts a cited competitive analysis. Not part of seedAgents(): it needs the watcher's id.
 */
export function chainSeedAgent(watcherId: string, research: ChainResearch): SeedAgent {
  const exa = research.kind === "exa";
  const researchStep = exa
    ? { id: "research", block: "connector" as const, params: { connector: research.connector, action: research.action, args: [{ name: "query", value: "{{steps.q.text}}" }, { name: "objective", value: "Find how competitors and the market handle these product features, for a short competitive analysis" }] } }
    : { id: "research", block: "hn_search" as const, params: { query: "{{steps.q.text}}", sinceHours: 8760, limit: 8 } };
  const spec: AgentSpec = {
    name: SEED_NAMES.deepDive,
    schedule: "0 16 * * 1",
    requiresApproval: false,
    trigger: { agentId: watcherId, when: "posted" },
    steps: [
      {
        id: "q",
        block: "llm",
        params: {
          instruction: exa
            ? "Write ONE web search query (4-8 words, no quotes) to research how competitors handle the product changes below (the product category and comparable features). Reply with the query only."
            : "Write ONE Hacker News search query of 2-3 words naming the product category of the changes below (e.g. 'anomaly detection'). Reply with the query only.",
          input: "{{trigger.message}}",
          format: "text",
        },
      },
      researchStep,
      {
        id: "analysis",
        block: "llm",
        params: {
          instruction:
            "For each Acme change in the watcher's post: what it is, how it compares to the market, and one implication for us — cite sources. One bullet per change (at most 4), under 45 words each. Cite a research URL when it supports the comparison, otherwise the Acme changelog URL from the post.",
          input: `Watcher post from {{trigger.agentName}}:\n{{trigger.message}}\n\nWeb research:\n${exa ? "{{steps.research.text}}" : "{{steps.research.items}}"}`,
          format: "cited_bullets",
        },
      },
      { id: "send", block: "send_slack", params: { message: "*Competitor deep-dive: Acme*\n{{steps.analysis.markdown}}", skipIfEmpty: true } },
    ],
    tests: [
      { kind: "nonempty", addedBy: "build" },
      { kind: "has_citations", addedBy: "build" },
      { kind: "max_items", config: { max: 4 }, addedBy: "build" },
    ],
    plan: {
      runs: `Whenever ${SEED_NAMES.watcher} posts`,
      checks: exa ? "The watcher's post plus web research (Exa search)" : "The watcher's post plus related Hacker News coverage",
      does: "Researches each Acme change and posts what it is, how it compares to the market, and one implication for us, with sources",
      sendsTo: "Slack",
      asksBefore: "Nothing",
    },
  };
  return {
    request: `When the ${SEED_NAMES.watcher} posts something new, research each change on the web and post a cited competitive analysis: what it is, how it compares to the market, and one implication for us.`,
    spec: AgentSpecSchema.parse(spec),
  };
}
