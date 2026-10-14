"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS } from "../ui-tokens";
import type { ChatItem } from "./events";

type Approval = Extract<ChatItem, { kind: "approval" }>;

const VERBS: Record<string, string> = { pause_agent: "Pause", edit_agent: "Edit", set_approval: "Change approval on" };
const HIDDEN_ARGS = new Set(["id", "name", "instruction"]);

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/** Amber card for a gated tool call. Buttons only: Enter never approves. */
export function ApprovalCard({ item, onAnswer }: { item: Approval; onAnswer: (requestId: string, approve: boolean) => void }) {
  const requestId = item.id.slice(2);
  const name = typeof item.input.name === "string" ? item.input.name : typeof item.input.id === "string" ? item.input.id : null;
  const verb = VERBS[item.toolName];
  const title = verb && name ? `${verb} ${name}?` : item.prompt || "Run a gated action?";
  const instruction = typeof item.input.instruction === "string" ? item.input.instruction : null;
  const args = Object.entries(item.input).filter(([k]) => !HIDDEN_ARGS.has(k));
  const pending = item.status === "pending" || item.status === "sending";
  const sending = item.status === "sending";
  return (
    <section aria-label="Approval request" className={cn("rounded-[3px] border border-l-[3px] p-3", pending ? "border-amber-300 border-l-amber-500 bg-amber-50" : "border-stone-300 border-l-stone-400 bg-stone-100")}>
      <div className="flex items-start gap-2.5">
        <ShieldAlert className={cn("mt-0.5 size-4 shrink-0", pending ? "text-amber-600" : "text-stone-400")} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold leading-snug text-stone-900">{title}</h3>
          <p className="mt-0.5 text-[12.5px] text-stone-600">{pending ? "Fleet Ops needs your approval before it does this." : "Decision recorded."}</p>
          {instruction && <blockquote className="mt-2 border-l-2 border-amber-400 pl-2.5 text-[13px] italic leading-relaxed text-stone-800">&ldquo;{instruction}&rdquo;</blockquote>}
          {args.length > 0 && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11.5px]">
              {args.map(([k, v]) => (<div key={k} className="contents"><dt className="text-stone-500">{k}</dt><dd className="break-all text-stone-800">{typeof v === "string" ? v : JSON.stringify(v)}</dd></div>))}
            </dl>
          )}
          {pending ? (
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={sending} onClick={() => onAnswer(requestId, true)}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-[3px] bg-stone-900 px-3 text-[13px] font-medium text-[#F6F4EF] hover:bg-stone-700 disabled:opacity-50", FOCUS)}>
                {sending && <Loader2 className="size-3.5 animate-spin" />}Approve
              </button>
              <button type="button" disabled={sending} onClick={() => onAnswer(requestId, false)}
                className={cn("inline-flex h-8 items-center rounded-[3px] border border-stone-400 bg-[#FBFAF7] px-3 text-[13px] font-medium text-stone-900 hover:bg-stone-100 disabled:opacity-50", FOCUS)}>Deny</button>
            </div>
          ) : (
            <p className="mt-2 font-mono text-[11.5px] text-stone-600">
              {item.status === "approved" ? "Approved by you" : "Denied"}{item.decidedAt ? ` · ${clock(item.decidedAt)}` : ""}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
