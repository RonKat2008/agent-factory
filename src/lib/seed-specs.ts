// The three demo agents. APP_URL is read at call time so local seeds point at the local server.
import { AgentSpecSchema, type AgentSpec } from "@/lib/spec";

export type SeedAgent = { request: string; spec: AgentSpec };

export const SEED_NAMES = {
  brief: "Daily AI agents brief",
  watcher: "Competitor watcher: Acme",
  next: "Next.js release assistant",
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
            config: { rubric: "Each bullet names a version and cites its release URL; risks are flagged with ⚠️ when the release mentions breaking changes, deprecations or security." },
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
