"use client";

import { Check, ChevronRight, Loader2, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { FOCUS } from "../ui-tokens";
import type { ChatItem } from "./events";

type Tool = Extract<ChatItem, { kind: "tool" }>;

const CLIP = "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap";

function Glyph({ status }: { status: Tool["status"] }) {
  if (status === "running") return <Loader2 className="size-3 animate-spin text-stone-500 motion-reduce:animate-none" aria-label="running" />;
  if (status === "waiting") return <TriangleAlert className="size-3 text-amber-600" aria-label="needs approval" />;
  if (status === "error") return <X className="size-3 text-red-600" aria-label="failed" />;
  return <Check className="size-3 text-emerald-600" aria-label="done" />;
}

function StepRow({ tool }: { tool: Tool }) {
  const [open, setOpen] = useState(false);
  const meta = [tool.status === "waiting" ? "needs approval" : tool.summary, tool.ms != null ? `${tool.ms}ms` : ""].filter(Boolean).join(" · ");
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={cn("flex w-full items-center gap-2 rounded-[2px] px-1.5 py-1 text-left font-mono text-[11.5px] text-stone-600 hover:bg-stone-200/60", FOCUS)}>
        <Glyph status={tool.status} />
        <span className={cn("shrink-0", tool.status === "error" ? "text-red-700" : "text-stone-800")}>→ {tool.name}</span>
        {meta && <span className={cn(CLIP, "text-stone-500")}>· {meta}</span>}
        <ChevronRight className={cn("ml-auto size-3 shrink-0 text-stone-400 transition-transform motion-reduce:transition-none", open && "rotate-90")} aria-hidden />
      </button>
      {open && (
        <div className="mx-1.5 mb-1 mt-0.5 max-h-44 overflow-auto rounded-[2px] border border-stone-300 bg-white p-2 font-mono text-[11px] leading-snug text-stone-700">
          <p className="mb-1 text-stone-400">args</p>
          <pre className="whitespace-pre-wrap break-all">{tool.args || "{}"}</pre>
          {tool.result && (<><p className="mb-1 mt-2 text-stone-400">result</p><pre className="whitespace-pre-wrap break-all">{tool.result}</pre></>)}
        </div>
      )}
    </li>
  );
}

/** Consecutive tool calls in a turn. Open while working; folds away once the answer starts (unless the user toggled it). */
export function StepsGroup({ tools, answerStarted }: { tools: Tool[]; answerStarted: boolean }) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? !answerStarted;
  const working = tools.some((t) => t.status === "running");
  return (
    <div className="rounded-[3px] border border-stone-300 bg-stone-100/70">
      <button type="button" onClick={() => setUserOpen(!open)} aria-expanded={open}
        className={cn("flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-[11px] text-stone-500", FOCUS)}>
        <ChevronRight className={cn("size-3 shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-90")} aria-hidden />
        <span className="shrink-0">{working ? "Working" : "Steps"} · {tools.length}</span>
        {!open && (
          <span className={cn(CLIP, "flex items-center gap-2 text-stone-600")}>
            {tools.slice(0, 3).map((t) => <span key={t.id} className="flex shrink-0 items-center gap-1"><Glyph status={t.status} />{t.name}</span>)}
          </span>
        )}
      </button>
      {open && <ul className="border-t border-stone-300 p-1">{tools.map((t) => <StepRow key={t.id} tool={t} />)}</ul>}
    </div>
  );
}
