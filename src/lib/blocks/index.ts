import type { BlockName, BlockResult, Step } from "@/lib/spec";
import { diffWithMemory } from "./diff-with-memory";
import { fetchRss } from "./fetch-rss";
import { fetchUrl } from "./fetch-url";
import { filter } from "./filter";
import { githubIssues } from "./github-issues";
import { hnSearch } from "./hn-search";
import { llm } from "./llm";
import { requireApproval } from "./require-approval";
import { sendSlack } from "./send-slack";
import type { BlockContext, BlockDef } from "./types";

export type { BlockContext, BlockDef, Item } from "./types";

export const BLOCKS: Record<BlockName, BlockDef> = {
  fetch_url: {
    run: fetchUrl,
    description: "Fetch a web page and return readable text plus its links. Fails on any non-2xx status.",
    params: "{ url }",
    outputs: "{ url, status, title, text (<=20k chars), links: {text, href}[] (<=200, absolute) }",
  },
  fetch_rss: {
    run: fetchRss,
    description: "Read an RSS 2.0 or Atom feed (also GitHub releases.atom).",
    params: "{ url, limit?=10 }",
    outputs: "{ items: Item[] }  Item = { title, url, summary?, publishedAt? }",
  },
  hn_search: {
    run: hnSearch,
    description: "Search Hacker News stories via Algolia.",
    params: "{ query, minPoints?, sinceHours?=24, limit?=10 }",
    outputs: "{ items: Item[] }  Item = { title, url, points, publishedAt }",
  },
  github_issues: {
    run: githubIssues,
    description: "List open GitHub issues (action=list) or apply labels/comments (action=label). Needs GITHUB_TOKEN.",
    params: "{ repo: 'owner/name', action: 'list'|'label', sinceHours?=168, input? (label only: template resolving to [{number, labels, comment?}]) }",
    outputs: "list -> { items: Item[] } Item = { number, title, url, body, labels }; label -> { applied } (dry run: { applied: 0, wouldApply })",
  },
  llm: {
    run: llm,
    description: "Ask a fast LLM to summarize/classify the input. Cited bullets only use URLs found in the input.",
    params: "{ instruction, input, format: 'text'|'cited_bullets'|'issue_labels' }",
    outputs:
      "cited_bullets -> { bullets: {text, url}[], markdown (Slack lines '• text — <url|source>', '' if none), empty }; text -> { text, markdown }; issue_labels -> { labels: {number, labels, comment}[], markdown }",
  },
  filter: {
    run: filter,
    description: "Keep items from an array where item[field] <op> value. Numeric compare for gt/gte/lt/lte; case-insensitive substring for contains.",
    params: "{ input (items array), field, op: 'gt'|'gte'|'lt'|'lte'|'eq'|'contains', value }",
    outputs: "{ items }",
  },
  diff_with_memory: {
    run: diffWithMemory,
    description: "Compare input to what the agent saw last run; remembers the new state (not in test runs).",
    params: "{ input (string or items array), memoryKey }",
    outputs: "{ changes: string[] (<=10 new entries), changed: boolean, firstRun: boolean, text: changes joined by newline }",
  },
  send_slack: {
    run: sendSlack,
    description: "Post the message to Slack (skipped when empty and skipIfEmpty is true).",
    params: "{ message, skipIfEmpty?: boolean }",
    outputs: "{ sent, skipped } (test runs: { sent: false, skipped: false, wouldSend })",
  },
  require_approval: {
    run: requireApproval,
    description: "Pause the run until a human approves; place before send_slack.",
    params: "{ message? }",
    outputs: "{ needsApproval: true, message }",
  },
};

const EXAMPLES: Record<BlockName, string> = {
  fetch_url: '{"id":"page","block":"fetch_url","params":{"url":"https://example.com/pricing"}}  -> {{steps.page.text}}, {{steps.page.links}}',
  fetch_rss: '{"id":"rel","block":"fetch_rss","params":{"url":"https://github.com/vercel/next.js/releases.atom","limit":5}}  -> {{steps.rel.items}}',
  hn_search: '{"id":"hn","block":"hn_search","params":{"query":"AI agents","minPoints":50,"sinceHours":24,"limit":10}}  -> {{steps.hn.items}}',
  github_issues: '{"id":"issues","block":"github_issues","params":{"repo":"owner/name","action":"list"}}  -> {{steps.issues.items}}',
  llm: '{"id":"sum","block":"llm","params":{"instruction":"Pick the 3 most important items","input":"{{steps.hn.items}}","format":"cited_bullets"}}  -> {{steps.sum.markdown}}',
  filter: '{"id":"top","block":"filter","params":{"input":"{{steps.hn.items}}","field":"points","op":"gte","value":100}}  -> {{steps.top.items}}',
  diff_with_memory: '{"id":"diff","block":"diff_with_memory","params":{"input":"{{steps.page.text}}","memoryKey":"pricing"}}  -> {{steps.diff.text}}, {{steps.diff.changed}}',
  send_slack: '{"id":"post","block":"send_slack","params":{"message":"{{steps.sum.markdown}}","skipIfEmpty":true}}',
  require_approval: '{"id":"approve","block":"require_approval","params":{"message":"Post this digest?"}}',
};

/** Compact prompt-ready catalog for the builder LLM. */
export function blockCatalog(): string {
  const names = Object.keys(BLOCKS) as BlockName[];
  const lines = names.map((n) => {
    const b = BLOCKS[n];
    return `### ${n}\n${b.description}\nparams: ${b.params}\noutputs: ${b.outputs}\nexample: ${EXAMPLES[n]}`;
  });
  return [
    "Blocks (reference earlier step outputs with {{steps.<id>.<field>}}; a param that is exactly one template keeps its raw array/object value):",
    ...lines,
  ].join("\n\n");
}

/** Runs one block. NEVER throws; errors become { ok:false, error }. */
export async function runBlock(step: Step, resolvedParams: unknown, ctx: BlockContext): Promise<BlockResult> {
  const def = BLOCKS[step.block];
  if (!def) return { ok: false, error: `Unknown block "${(step as { block: string }).block}"` };
  try {
    return await def.run(resolvedParams, ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
