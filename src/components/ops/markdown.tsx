// Small, safe markdown renderer for assistant text: bold, inline code, http(s) links, lists, paragraphs.
// Builds React nodes only; no HTML injection.
import Link from "next/link";
import type { ReactNode } from "react";
import type { AgentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AgentRef = { id: string; name: string; status: AgentStatus };

// Same semantic dot colors as StatusPill.
const DOT: Record<AgentStatus, string> = {
  live: "bg-emerald-500", broken: "bg-red-500", repairing: "bg-amber-500", needs_human: "bg-red-600",
  paused: "bg-stone-400", building: "bg-sky-500", testing: "bg-sky-500", ready: "bg-sky-600",
};

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function AgentChip({ agent }: { agent: AgentRef }) {
  return (
    <Link href={`/agents/${agent.id}`} title={`${agent.name} · ${agent.status}`}
      className="mx-0.5 inline-flex items-center gap-1.5 rounded-[3px] border border-stone-300 bg-stone-100 px-1.5 py-px align-baseline text-[0.93em] font-medium text-stone-900 no-underline transition-colors hover:border-stone-500 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40">
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[agent.status] ?? "bg-stone-400")} aria-hidden />
      {agent.name}
    </Link>
  );
}

/** Splits plain text into text + agent chips for any known agent name. */
function withChips(text: string, agents: AgentRef[], key: string): ReactNode[] {
  if (!agents.length) return [text];
  const sorted = [...agents].sort((a, b) => b.name.length - a.name.length);
  const re = new RegExp(`(${sorted.map((a) => escapeRe(a.name)).join("|")})`, "g");
  return text.split(re).map((part, i) => {
    const agent = sorted.find((a) => a.name === part);
    return agent ? <AgentChip key={`${key}-c${i}`} agent={agent} /> : part;
  });
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)<]+)/g;
const LINK_CLASS = "text-violet-700 underline decoration-violet-300 underline-offset-2 hover:decoration-violet-700 break-all";

function inline(text: string, keyBase: string, agents: AgentRef[]): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={key} className="font-semibold text-stone-900">{inline(part.slice(2, -2), key, agents)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={key} className="rounded-[2px] bg-stone-200/70 px-1 font-mono text-[12px]">{part.slice(1, -1)}</code>;
    const md = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
    const linked = md ? agents.find((a) => a.name === md[1]) : undefined;
    if (linked) return <AgentChip key={key} agent={linked} />;
    if (md) return <a key={key} href={md[2]} target="_blank" rel="noopener noreferrer nofollow" className={LINK_CLASS}>{md[1]}</a>;
    if (/^https?:\/\//.test(part)) return <a key={key} href={part} target="_blank" rel="noopener noreferrer nofollow" className={LINK_CLASS}>{part}</a>;
    return withChips(part, agents, key);
  });
}

const ROW = /^\s*\|.*\|\s*$/;
const SEPARATOR = /^\s*\|[\s:|-]+\|\s*$/;
const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function Table({ rows, keyBase, agents }: { rows: string[][]; keyBase: string; agents: AgentRef[] }) {
  const [head, ...body] = rows;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[12px]">
        <thead><tr>{head.map((h, i) => <th key={i} className="border-b border-stone-300 px-1.5 py-1 font-mono text-[10.5px] font-medium text-stone-500">{inline(h, `${keyBase}h${i}`, agents)}</th>)}</tr></thead>
        <tbody>{body.map((r, ri) => <tr key={ri} className="border-b border-stone-200 last:border-0">{r.map((c, ci) => <td key={ci} className="px-1.5 py-1 align-top tabular-nums">{inline(c, `${keyBase}r${ri}c${ci}`, agents)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function Markdown({ text, agents = [] }: { text: string; agents?: AgentRef[] }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (ROW.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && ROW.test(lines[i])) { if (!SEPARATOR.test(lines[i])) rows.push(cells(lines[i])); i++; }
      if (rows.length) blocks.push(<Table key={blocks.length} rows={rows} keyBase={`t${blocks.length}`} agents={agents} />);
      continue;
    }
    const kind = BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : null;
    if (kind) {
      const re = kind === "ul" ? BULLET : NUMBERED;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) { items.push(re.exec(lines[i])![1]); i++; }
      const List = kind;
      blocks.push(
        <List key={blocks.length} className={`ml-4 space-y-1 ${kind === "ul" ? "list-disc" : "list-decimal"} marker:text-stone-400`}>
          {items.map((it, n) => <li key={n}>{inline(it, `${blocks.length}-${n}`, agents)}</li>)}
        </List>,
      );
      continue;
    }
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(<p key={blocks.length} className="font-semibold text-stone-900">{inline(heading[1], `h${blocks.length}`, agents)}</p>);
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !ROW.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i]) && !/^#{1,4}\s/.test(lines[i])) { para.push(lines[i]); i++; }
    blocks.push(<p key={blocks.length}>{para.flatMap((l, n) => (n ? [<br key={`br${n}`} />, ...inline(l, `${blocks.length}-${n}`, agents)] : inline(l, `${blocks.length}-${n}`, agents)))}</p>);
  }
  return <div className="space-y-2 break-words">{blocks}</div>;
}
