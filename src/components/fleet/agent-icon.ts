import { Bell, Bot, CloudSun, CodeXml, Globe, Newspaper, Rss, Search, TrendingUp, type LucideIcon } from "lucide-react";
import type { Agent } from "@/lib/types";

/** Ordered: first match wins. Matched against the plan's sources, then the request. */
const RULES: { re: RegExp; icon: LucideIcon }[] = [
  { re: /hacker ?news|\bhn\b|news|headline|techcrunch|reddit/i, icon: Newspaper },
  { re: /github|repo|pull request|issue|release|changelog|npm|next\.js|code/i, icon: CodeXml },
  { re: /\brss\b|feed|blog|substack/i, icon: Rss },
  { re: /weather|forecast|temperature/i, icon: CloudSun },
  { re: /stock|price|market|crypto|competitor|pricing/i, icon: TrendingUp },
  { re: /alert|monitor|status|uptime|down\b|incident/i, icon: Bell },
  { re: /search|find|look up/i, icon: Search },
  { re: /https?:|website|page|site|url|web/i, icon: Globe },
];

/** An icon for the agent's main source, so cards are recognisable at a glance. */
export function agentIcon(agent: Pick<Agent, "plan" | "request" | "name">): LucideIcon {
  const haystacks = [agent.plan?.checks ?? "", agent.request, agent.name];
  for (const text of haystacks) {
    const hit = RULES.find((r) => r.re.test(text));
    if (hit) return hit.icon;
  }
  return Bot;
}

const trimDot = (s: string) => s.trim().replace(/[.]+$/, "");

/** "Every 30 minutes · reads Hacker News · posts to Slack", built from the plan card. */
export function planLine(agent: Pick<Agent, "plan" | "scheduleHuman">): string {
  const p = agent.plan;
  if (!p) return agent.scheduleHuman;
  const parts = [trimDot(p.runs || agent.scheduleHuman)];
  if (p.checks) parts.push(`reads ${trimDot(p.checks).replace(/^reads\s+/i, "")}`);
  if (p.sendsTo) parts.push(`posts to ${trimDot(p.sendsTo).replace(/^(posts|sends) to\s+/i, "")}`);
  return parts.join(" · ");
}
