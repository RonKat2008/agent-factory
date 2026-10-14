// Plain-English readings of the agent's internals for people who never want to see a spec.
import type { AgentStatus, AgentTest } from "@/lib/types";
import type { AgentSpec } from "@/lib/spec";

export function testLabel(t: AgentTest): string {
  switch (t.kind) {
    case "has_citations":
      return "Every item links to its source";
    case "max_items":
      return t.config?.max ? `At most ${t.config.max} items` : "Keeps the list short";
    case "nonempty":
      return "Has something to say";
    case "no_post_if_unchanged":
      return "Stays quiet when nothing changed";
    case "llm_judge":
      return t.config?.rubric ? `Quality check: ${t.config.rubric}` : "Quality check";
    case "step_succeeds":
      return "Source page loads";
  }
}

export type Source = { label: string; detail?: string; href?: string };

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const isUrl = (s: string) => /^https?:\/\//.test(s);
const titleCase = (s: string) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** What the agent reads, one entry per source step (templated params are left out). */
export function sourcesFromSpec(spec: AgentSpec): Source[] {
  const out: Source[] = [];
  for (const s of spec.steps) {
    if (s.block === "hn_search") out.push({ label: "Hacker News", detail: `stories about “${s.params.query}”` });
    else if (s.block === "fetch_url" && isUrl(s.params.url)) out.push({ label: host(s.params.url), detail: "website", href: s.params.url });
    else if (s.block === "fetch_rss" && isUrl(s.params.url)) out.push({ label: host(s.params.url), detail: "news feed", href: s.params.url });
    else if (s.block === "github_issues") out.push({ label: `GitHub · ${s.params.repo}`, detail: "issues", href: `https://github.com/${s.params.repo}` });
    else if (s.block === "connector") out.push({ label: titleCase(s.params.connector), detail: titleCase(s.params.action) });
    else if (s.block === "recall") out.push({ label: "What your other agents already found" });
  }
  return out;
}

export function fixLine(message: string): string {
  const summary = message.replace(/;?\s*v\d+ written\.?$/i, "").trim();
  return `Fixed: ${summary} and re-tested ✓`;
}

export const STATUS_WORDS: Record<AgentStatus, { text: string; dot: string }> = {
  live: { text: "On", dot: "bg-emerald-500" },
  repairing: { text: "Fixing itself…", dot: "bg-amber-500 motion-safe:animate-pulse" },
  paused: { text: "Paused", dot: "bg-stone-400" },
  broken: { text: "Hit a problem", dot: "bg-red-500" },
  needs_human: { text: "Needs your help", dot: "bg-red-600" },
  building: { text: "Being built…", dot: "bg-sky-500 motion-safe:animate-pulse" },
  testing: { text: "Being tested…", dot: "bg-sky-500 motion-safe:animate-pulse" },
  ready: { text: "Ready to turn on", dot: "bg-violet-600" },
};

/** Slack mrkdwn flattened to one readable line for previews. */
export function plainPreview(text: string, max = 140): string {
  const flat = text
    .replace(/<(https?:\/\/[^|>\s]+)\|([^>]*)>/g, "$2")
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
