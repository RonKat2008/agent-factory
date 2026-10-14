// Export an Agent Factory spec as a standalone eve project (https://eve.dev, npm `eve`).
// Pure: AgentSpec in, { path: contents } out. Tool sources are self-contained templates.
import type { AgentSpec, Step } from "@/lib/spec";

export type EveExportOpts = { factoryUrl: string; agentId: string; version: number };

export function agentSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "agent";
}

const TOOL_HEAD = `import { defineTool } from "eve/tools";\nimport { z } from "zod";\n`;

const FETCH_URL = `${TOOL_HEAD}
export default defineTool({
  description: "Fetch a web page and return its readable text (HTML tags stripped).",
  inputSchema: z.object({ url: z.string().url() }),
  async execute({ url }) {
    const res = await fetch(url, { headers: { "user-agent": "eve-agent" } });
    const html = await res.text();
    const text = html
      .replace(/<(script|style)[\\s\\S]*?<\\/\\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\\s+/g, " ")
      .trim();
    return { status: res.status, text: text.slice(0, 20000) };
  },
});
`;

const FETCH_RSS = `${TOOL_HEAD}
const pick = (xml: string, tag: string) =>
  xml.match(new RegExp("<" + tag + "[^>]*>([\\\\s\\\\S]*?)</" + tag + ">", "i"))?.[1]
    ?.replace(/<!\\[CDATA\\[|\\]\\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .trim() ?? "";

export default defineTool({
  description: "Fetch an RSS or Atom feed and return its latest items (title, url, published).",
  inputSchema: z.object({ url: z.string().url(), limit: z.number().int().min(1).max(50).default(10) }),
  async execute({ url, limit }) {
    const xml = await (await fetch(url, { headers: { "user-agent": "eve-agent" } })).text();
    const blocks = xml.match(/<(item|entry)[\\s>][\\s\\S]*?<\\/\\1>/gi) ?? [];
    return blocks.slice(0, limit).map((b) => ({
      title: pick(b, "title"),
      url: b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? pick(b, "link"),
      published: pick(b, "pubDate") || pick(b, "updated") || pick(b, "published"),
    }));
  },
});
`;

const HN_SEARCH = `${TOOL_HEAD}
export default defineTool({
  description: "Search Hacker News stories (Algolia) by keyword, newest first.",
  inputSchema: z.object({
    query: z.string(),
    minPoints: z.number().int().optional(),
    sinceHours: z.number().int().optional(),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  async execute({ query, minPoints, sinceHours, limit }) {
    const filters: string[] = [];
    if (minPoints) filters.push("points>=" + minPoints);
    if (sinceHours) filters.push("created_at_i>" + (Math.floor(Date.now() / 1000) - sinceHours * 3600));
    const qs = new URLSearchParams({ query, tags: "story", hitsPerPage: String(limit) });
    if (filters.length) qs.set("numericFilters", filters.join(","));
    const data = (await (await fetch("https://hn.algolia.com/api/v1/search_by_date?" + qs)).json()) as {
      hits: { objectID: string; title: string; url?: string; points: number; num_comments: number }[];
    };
    return data.hits.map((h) => ({
      title: h.title,
      url: h.url ?? "https://news.ycombinator.com/item?id=" + h.objectID,
      discussion: "https://news.ycombinator.com/item?id=" + h.objectID,
      points: h.points,
      comments: h.num_comments,
    }));
  },
});
`;

const GITHUB_ISSUES = `${TOOL_HEAD}
const gh = (path: string, init: RequestInit = {}) =>
  fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      ...(process.env.GITHUB_TOKEN ? { authorization: "Bearer " + process.env.GITHUB_TOKEN } : {}),
    },
  });

export default defineTool({
  description: "List recent open issues of a GitHub repo, or add labels and a comment to issues.",
  inputSchema: z.object({
    repo: z.string().describe("owner/name"),
    action: z.enum(["list", "label"]),
    sinceHours: z.number().int().optional(),
    items: z
      .array(z.object({ number: z.number().int(), labels: z.array(z.string()), comment: z.string().optional() }))
      .optional()
      .describe("For action=label"),
  }),
  async execute({ repo, action, sinceHours, items }) {
    if (action === "list") {
      const since = new Date(Date.now() - (sinceHours ?? 24) * 3600_000).toISOString();
      const res = await gh("/repos/" + repo + "/issues?state=open&per_page=50&since=" + since);
      if (!res.ok) throw new Error("GitHub " + res.status);
      const issues = (await res.json()) as { number: number; title: string; body?: string; html_url: string; pull_request?: unknown }[];
      return issues
        .filter((i) => !i.pull_request)
        .map((i) => ({ number: i.number, title: i.title, body: (i.body ?? "").slice(0, 1000), url: i.html_url }));
    }
    for (const it of items ?? []) {
      await gh("/repos/" + repo + "/issues/" + it.number + "/labels", { method: "POST", body: JSON.stringify({ labels: it.labels }) });
      if (it.comment) await gh("/repos/" + repo + "/issues/" + it.number + "/comments", { method: "POST", body: JSON.stringify({ body: it.comment }) });
    }
    return { labeled: items?.length ?? 0 };
  },
});
`;

const sendSlack = (gated: boolean) => `import { defineTool } from "eve/tools";
${gated ? 'import { always } from "eve/tools/approval";\n' : ""}import { z } from "zod";

export default defineTool({
  description: "Post a message to Slack (markdown). Include source URLs in the message.",
  inputSchema: z.object({ message: z.string().min(1) }),${gated ? "\n  approval: always()," : ""}
  async execute({ message }) {
    const hook = process.env.SLACK_WEBHOOK_URL;
    if (!hook) throw new Error("SLACK_WEBHOOK_URL is not set");
    const res = await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    if (!res.ok) throw new Error("Slack " + res.status);
    return { posted: true };
  },
});
`;

const SNAPSHOT_MEMORY = `import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";

// One shared document the agent uses to remember what it saw on its previous run.
export default defineMemory({
  description:
    "Snapshots of what you saw on previous runs, keyed by name. Read it to tell what is new; save the current items after each run.",
  provider: fileMemory(),
  scope: "agent",
});
`;

const tpl = (s: string) => s.replace(/\{\{\s*steps\.([\w-]+)\.?([\w.[\]-]*)\s*\}\}/g, (_m, id, f) => `[${f ? f + " of " : "output of "}step "${id}"]`);

function describe(step: Step): string {
  switch (step.block) {
    case "fetch_url":
      return `Use the fetch_url tool on ${tpl(step.params.url)}. (step "${step.id}")`;
    case "fetch_rss":
      return `Use the fetch_rss tool on ${tpl(step.params.url)}${step.params.limit ? `, limit ${step.params.limit}` : ""}. (step "${step.id}")`;
    case "hn_search": {
      const p = step.params;
      const extra = [p.minPoints && `at least ${p.minPoints} points`, p.sinceHours && `from the last ${p.sinceHours} hours`, p.limit && `limit ${p.limit}`].filter(Boolean);
      return `Use the hn_search tool for "${p.query}"${extra.length ? " (" + extra.join(", ") + ")" : ""}. (step "${step.id}")`;
    }
    case "github_issues":
      return step.params.action === "list"
        ? `Use the github_issues tool with action "list" on ${step.params.repo}${step.params.sinceHours ? `, issues from the last ${step.params.sinceHours} hours` : ""}. (step "${step.id}")`
        : `Use the github_issues tool with action "label" on ${step.params.repo}, applying the labels and comments from ${tpl(step.params.input ?? "the previous step")}. (step "${step.id}")`;
    case "llm": {
      const fmt = { text: "plain text", cited_bullets: "markdown bullets, each ending with its source URL", issue_labels: "a list of { number, labels, comment? } objects" }[step.params.format];
      return `Yourself (no tool): ${step.params.instruction} Work from ${tpl(step.params.input)}. Output ${fmt}. (step "${step.id}")`;
    }
    case "filter":
      return `Yourself (no tool): from ${tpl(step.params.input)}, keep only items whose "${step.params.field}" ${{ gt: ">", gte: ">=", lt: "<", lte: "<=", eq: "equals", contains: "contains" }[step.params.op]} ${JSON.stringify(step.params.value)}. (step "${step.id}")`;
    case "diff_with_memory":
      return `Compare ${tpl(step.params.input)} with the last_snapshot memory entry "${step.params.memoryKey}". Keep only what is new or changed, then save the full current list back under that key. If nothing is new, stop and do not post anything. (step "${step.id}")`;
    case "send_slack":
      return `Use the send_slack tool to post: ${tpl(step.params.message)}${step.params.skipIfEmpty ? " Skip posting if there is nothing to report." : ""} (step "${step.id}")`;
    case "require_approval":
      return `Ask for human approval before continuing${step.params.message ? `: ${tpl(step.params.message)}` : ""}. (step "${step.id}")`;
    case "connector":
      return `Call the "${step.params.action}" action of the custom connector "${step.params.connector}"${step.params.args.length ? ` with ${step.params.args.map((a) => `${a.name}=${tpl(a.value)}`).join(", ")}` : ""}. (step "${step.id}")`;
    case "run_code":
      return `Yourself (no tool): apply this JavaScript logic mentally to ${tpl(step.params.input)} and use its result:\n   ${step.params.code.split("\n").join("\n   ")}\n   (step "${step.id}")`;
  }
}

function describeTest(t: AgentSpec["tests"][number]): string {
  const c = t.config ?? {};
  const base = {
    nonempty: "The final message is non-empty (unless nothing changed).",
    has_citations: "Every bullet in the final message links to a source URL.",
    max_items: `The final message has at most ${c.max ?? "N"} bullets.`,
    llm_judge: `Quality rubric: ${c.rubric ?? ""}`,
    no_post_if_unchanged: "When nothing changed since the last run, nothing is posted.",
    step_succeeds: `Step "${c.stepId ?? ""}" returns non-empty output.`,
  }[t.kind];
  return t.note ? `${base} (${t.note})` : base;
}

function instructions(spec: AgentSpec): string {
  const p = spec.plan;
  const steps = spec.steps.map((s, i) => `${i + 1}. ${describe(s)}`).join("\n");
  const tests = spec.tests.map((t, i) => `${i + 1}. ${describeTest(t)}`).join("\n");
  return `# ${spec.name}

You are a scheduled agent. Run: ${p.runs}.

- Checks: ${p.checks}
- Does: ${p.does}
- Sends to: ${p.sendsTo}
- Asks before acting: ${p.asksBefore}

## Steps

Do these in order. Pass each step's result to the next.

${steps}

## Your output must satisfy

${tests}
${spec.requiresApproval ? "\nAnything posted externally requires human approval first.\n" : ""}`;
}

const q = (s: string) => JSON.stringify(s);

export function specToEveProject(spec: AgentSpec, opts: EveExportOpts): Record<string, string> {
  const slug = agentSlug(spec.name);
  const blocks = new Set(spec.steps.map((s) => s.block));
  const gated = spec.requiresApproval || blocks.has("require_approval");
  const files: Record<string, string> = {};

  files["package.json"] =
    JSON.stringify(
      {
        name: `${slug}-eve`,
        version: "0.1.0",
        private: true,
        type: "module",
        engines: { node: ">=24" },
        scripts: { dev: "eve dev", build: "eve build", start: "eve start", deploy: "eve deploy", typecheck: "tsc --noEmit" },
        dependencies: { eve: "latest", ai: "latest", zod: "latest" },
        devDependencies: { typescript: "^5.6.0", "@types/node": "^24.0.0" },
      },
      null,
      2,
    ) + "\n";
  files["tsconfig.json"] =
    JSON.stringify(
      { compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, skipLibCheck: true, noEmit: true, types: ["node"] }, include: ["agent/**/*.ts"] },
      null,
      2,
    ) + "\n";
  files["agent/agent.ts"] = `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "anthropic/claude-sonnet-5.5", // via Vercel AI Gateway\n});\n`;
  files["agent/instructions.md"] = instructions(spec);
  files[`agent/schedules/${slug}.ts`] = `import { defineSchedule } from "eve/schedules";\n\nexport default defineSchedule({\n  cron: ${q(spec.schedule)}, // UTC\n  markdown: ${q(`Run your scheduled job now: ${spec.plan.does}. Follow your instructions step by step.`)},\n});\n`;

  const toolSrc: Partial<Record<Step["block"], string>> = {
    fetch_url: FETCH_URL,
    fetch_rss: FETCH_RSS,
    hn_search: HN_SEARCH,
    github_issues: GITHUB_ISSUES,
  };
  for (const [block, src] of Object.entries(toolSrc)) if (blocks.has(block as Step["block"])) files[`agent/tools/${block}.ts`] = src!;
  if (blocks.has("send_slack")) files["agent/tools/send_slack.ts"] = sendSlack(gated);
  if (blocks.has("diff_with_memory")) files["agent/memory/last_snapshot.ts"] = SNAPSHOT_MEMORY;

  const env = ["# AI Gateway key for non-Vercel hosts (on Vercel, project OIDC is used)", "AI_GATEWAY_API_KEY="];
  if (blocks.has("send_slack")) env.push("SLACK_WEBHOOK_URL=");
  if (blocks.has("github_issues")) env.push("GITHUB_TOKEN=");
  files[".env.example"] = env.join("\n") + "\n";

  const vars = env.filter((l) => /^[A-Z_]+=/.test(l)).map((l) => `- \`${l.split("=")[0]}\``).join("\n");
  files["README.md"] = `# ${spec.name}

Exported from Agent Factory v${opts.version} (agent \`${opts.agentId}\`, ${opts.factoryUrl}) as a standalone [eve](https://www.npmjs.com/package/eve) agent. Requires Node.js 24+.

Schedule: \`${spec.schedule}\` (UTC), defined in \`agent/schedules/${slug}.ts\`.

## Run locally

\`\`\`bash
npm install
cp .env.example .env   # fill in values
npm run dev            # terminal UI; schedules do not fire in dev
curl -X POST http://localhost:2000/eve/v1/dev/schedules/${slug}   # trigger the schedule once
\`\`\`

## Deploy to Vercel

\`\`\`bash
npx eve link
npx eve deploy
\`\`\`

Set these environment variables in the Vercel project:

${vars}
${gated ? "\n## Approval\n\n`send_slack` uses `approval: always()`. eve schedules have no channel, so a scheduled run that reaches an approval-gated call fails instead of waiting. Add a channel (`npx eve add`) and route the schedule through it, or remove `approval` from `agent/tools/send_slack.ts` to post unattended.\n" : ""}
## Tests it passed in Agent Factory

Exported from Agent Factory v${opts.version} — tests it passed:

${spec.tests.map((t) => `- ${describeTest(t)}`).join("\n")}
`;
  return files;
}
