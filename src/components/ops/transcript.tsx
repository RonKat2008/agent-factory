"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LayoutList } from "@/components/motion";
import { FOCUS } from "../ui-tokens";
import { ApprovalCard } from "./approval-card";
import type { ChatItem } from "./events";
import { Markdown, type AgentRef } from "./markdown";
import { StepsGroup } from "./steps";
import type { ChatStatus } from "./use-ops-chat";

type Tool = Extract<ChatItem, { kind: "tool" }>;
type Turn = { kind: "user"; item: Extract<ChatItem, { kind: "user" }> } | { kind: "ops"; items: ChatItem[] };

function toTurns(items: ChatItem[]): Turn[] {
  const turns: Turn[] = [];
  for (const item of items) {
    if (item.kind === "user") turns.push({ kind: "user", item });
    else {
      const last = turns.at(-1);
      if (last?.kind === "ops") last.items.push(item);
      else turns.push({ kind: "ops", items: [item] });
    }
  }
  return turns;
}

function Avatar() {
  return <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[3px] border border-stone-400 bg-stone-100 font-mono text-[9px] font-semibold tracking-wider text-stone-700">OPS</span>;
}

function OpsRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-3"><Avatar /><div className="min-w-0 flex-1 space-y-2.5">{children}</div></div>;
}

function Thinking() {
  return <OpsRow><p className="animate-pulse py-0.5 font-mono text-[12px] text-stone-500 motion-reduce:animate-none">Thinking…</p></OpsRow>;
}

function ErrorNote({ item, onRetry, canRetry }: { item: Extract<ChatItem, { kind: "error" }>; onRetry: () => void; canRetry: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const until = item.retryUntil ?? 0;
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [until]);
  const wait = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <div role="alert" className="flex items-center gap-3 rounded-[3px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
      <p className="min-w-0 flex-1">{item.text}{wait > 0 && <span className="ml-1 font-mono tabular-nums">Try again in {wait}s.</span>}</p>
      {item.retryable && (
        <button type="button" onClick={onRetry} disabled={wait > 0 || !canRetry}
          className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[3px] border border-red-300 bg-white px-2 text-[12px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-50", FOCUS)}>
          <RotateCcw className="size-3" />Retry
        </button>
      )}
    </div>
  );
}

function OpsTurn({ items, streamingId, agents, onAnswer, onRetry, canRetry }: {
  items: ChatItem[]; streamingId: string | null; agents: AgentRef[];
  onAnswer: (requestId: string, approve: boolean) => void; onRetry: () => void; canRetry: boolean;
}) {
  const blocks: ReactNode[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "tool") {
      const tools: Tool[] = [item];
      while (items[i + 1]?.kind === "tool") tools.push(items[++i] as Tool);
      const answerStarted = items.slice(i + 1).some((n) => n.kind === "assistant" && n.text);
      blocks.push(<StepsGroup key={tools[0].id} tools={tools} answerStarted={answerStarted} />);
    } else if (item.kind === "assistant") {
      if (!item.text) continue;
      const caret = item.id === streamingId ? "[&>*:last-child]:after:ml-0.5 [&>*:last-child]:after:inline-block [&>*:last-child]:after:h-[0.95em] [&>*:last-child]:after:w-[6px] [&>*:last-child]:after:translate-y-[2px] [&>*:last-child]:after:bg-stone-800 [&>*:last-child]:after:content-['']" : "";
      blocks.push(<div key={item.id} className={cn("text-[14px] leading-relaxed text-stone-800", caret)}><Markdown text={item.text} agents={agents} /></div>);
    } else if (item.kind === "approval") {
      blocks.push(<ApprovalCard key={item.id} item={item} onAnswer={onAnswer} />);
    } else if (item.kind === "error") {
      blocks.push(<ErrorNote key={item.id} item={item} onRetry={onRetry} canRetry={canRetry} />);
    }
  }
  return <OpsRow>{blocks}</OpsRow>;
}

export function Transcript({ items, status, agents, onAnswer, onRetry }: {
  items: ChatItem[]; status: ChatStatus; agents: AgentRef[];
  onAnswer: (requestId: string, approve: boolean) => void; onRetry: () => void;
}) {
  const turns = toTurns(items);
  const last = items.at(-1);
  const working = status === "working";
  const streamingId = working && last?.kind === "assistant" && !last.done ? last.id : null;
  const thinking = working && (last?.kind === "user" || (last?.kind === "tool" && last.status === "done") || last?.kind === "approval");
  return (
    <div className="flex flex-col gap-5">
      <LayoutList
        as="div"
        enterFrom="bottom"
        className="flex flex-col gap-5"
        items={turns}
        getKey={(t) => (t.kind === "user" ? t.item.id : t.items[0].id)}
        renderItem={(t, n) =>
          t.kind === "user" ? (
            <div className="ml-auto w-fit max-w-[calc(100%-2.5rem)] whitespace-pre-wrap break-words rounded-[3px] bg-stone-900 px-3 py-2 text-[14px] leading-snug text-[#F6F4EF]">{t.item.text}</div>
          ) : (
            <OpsTurn items={t.items} streamingId={streamingId} agents={agents} onAnswer={onAnswer} onRetry={onRetry} canRetry={status === "idle" && n === turns.length - 1} />
          )
        }
      />
      {thinking && <Thinking />}
    </div>
  );
}
