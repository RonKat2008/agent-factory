"use client";

import { ArrowDown, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Term } from "@/components/explain";
import { SPRING } from "@/components/motion/tokens";
import { cn } from "@/lib/utils";
import { FOCUS } from "../ui-tokens";
import { Composer } from "./composer";
import type { ChatItem } from "./events";
import type { AgentRef } from "./markdown";
import { Transcript } from "./transcript";
import type { ChatStatus } from "./use-ops-chat";

export const SUGGESTIONS = [
  "What broke today?",
  "Which agent costs the most?",
  "What did my agents learn about Acme?",
];

const GENERIC_FOLLOW_UPS = ["List the agents and their health", "What got repaired in the last 24 hours?", "Which agent is the most useful?"];
const FOLLOW_UPS: Record<string, string[]> = {
  list_agents: ["Which agent needs attention most?", "What got repaired in the last 24 hours?"],
  get_agent: ["Why did it fail recently?", "Run it now", "Show its version history"],
  fleet_feed: ["Which agent failed the most?", "List the agents and their health"],
  fleet_stats: ["Which agent costs the most?", "List the agents and their health"],
  pause_agent: ["List the agents and their health"],
  edit_agent: ["How did the new version do on its test run?"],
  run_agent: ["Did that run succeed?", "List the agents and their health"],
};
const NEAR_BOTTOM_PX = 80;
const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

function followUpsFor(items: ChatItem[]): string[] {
  const lastUser = items.findLastIndex((i) => i.kind === "user");
  const turn = items.slice(lastUser + 1);
  if (!turn.some((i) => i.kind === "assistant" && i.text)) return [];
  const tool = [...turn].reverse().find((i) => i.kind === "tool");
  return (tool?.kind === "tool" && FOLLOW_UPS[tool.name]) || GENERIC_FOLLOW_UPS.slice(0, 3);
}

function Chip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn("rounded-[3px] border border-stone-300 bg-[#FBFAF7] px-2.5 py-1.5 text-left text-[13px] text-stone-800 transition-colors hover:border-stone-500 hover:bg-stone-100 active:translate-y-px disabled:opacity-50", FOCUS)}>{label}</button>
  );
}

export function OpsPanel({ open, onClose, items, status, agents, mac, onSend, onStop, onRetry, onAnswer, onReset }: {
  open: boolean; onClose: () => void; items: ChatItem[]; status: ChatStatus; agents: AgentRef[]; mac: boolean;
  onSend: (text: string) => void; onStop: () => void; onRetry: () => void;
  onAnswer: (requestId: string, approve: boolean) => void; onReset: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [stuck, setStuck] = useState(true);

  const scrollToEnd = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  const setStick = (v: boolean) => { stickRef.current = v; setStuck(v); };

  // Follow new tokens only while the reader is at the bottom.
  useEffect(() => { if (stickRef.current) scrollToEnd(); }, [items, status, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); lastNode.focus(); }
      else if (!e.shiftKey && active === lastNode) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const busy = status !== "idle";
  const followUps = !busy ? followUpsFor(items) : [];
  const send = (text: string) => { setStick(true); onSend(text); };
  const lockedUntil = Math.max(0, ...items.map((i) => (i.kind === "error" ? i.retryUntil ?? 0 : 0)));

  return (
    <>
      <div onClick={onClose} aria-hidden className={cn("fixed inset-0 z-40 bg-stone-900/25 transition-opacity duration-200 motion-reduce:transition-none", open ? "opacity-100" : "pointer-events-none opacity-0")} />
      <motion.aside ref={panelRef} role="dialog" aria-modal="true" aria-label="Ask Ops" aria-hidden={!open} inert={!open}
        initial={false}
        animate={open ? { x: 0, opacity: 1 } : { x: "100%", opacity: 0 }}
        transition={SPRING.gentle}
        className={cn("fixed inset-y-0 right-0 z-50 flex w-[min(560px,100vw)] flex-col border-l border-stone-400 bg-[#FBFAF7] shadow-[-8px_0_24px_rgba(28,25,23,0.10)]", !open && "pointer-events-none")}>
        <header className="flex shrink-0 items-center gap-3 border-b border-stone-300 bg-[#FBFAF7] px-4 py-3">
          <span className="relative flex size-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <h2 className="text-[15px] font-semibold text-stone-900">Fleet Ops</h2>
          <span className="rounded-[2px] border border-stone-300 bg-stone-100 px-1.5 py-px font-mono text-[10.5px] text-stone-500">Powered by eve</span>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={onReset} disabled={!items.length} title="New chat" aria-label="New chat"
              className={cn("grid size-8 place-items-center rounded-[3px] text-stone-500 hover:bg-stone-200/70 hover:text-stone-900 disabled:opacity-40", FOCUS)}><RotateCcw className="size-4" /></button>
            <button type="button" onClick={onClose} aria-label="Close" className={cn("grid size-8 place-items-center rounded-[3px] text-stone-500 hover:bg-stone-200/70 hover:text-stone-900", FOCUS)}><X className="size-4" /></button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} role="log" aria-live="polite" aria-label="Conversation"
            onScroll={(e) => { const el = e.currentTarget; setStick(el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX); }}
            className="flex h-full flex-col overflow-y-auto px-4 py-5">
            {items.length === 0 ? (
              <div className="my-auto">
                <h3 className="text-[22px] font-semibold leading-tight text-stone-900">Ask anything about your agents</h3>
                <p className="mt-2 max-w-[44ch] text-[14px] leading-relaxed text-stone-600">Try &ldquo;what broke today?&rdquo; <Term id="fleet-ops">Ask Ops</Term> can look into agents, explain failures, run them, pause them and edit them. It always asks for your OK before changing anything.</p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => <li key={s} className="flex"><Chip label={s} onClick={() => send(s)} disabled={busy} /></li>)}
                </ul>
              </div>
            ) : (
              <>
                <Transcript items={items} status={status} agents={agents} onAnswer={onAnswer} onRetry={onRetry} />
                {followUps.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2 pl-9" aria-label="Suggested follow-ups">
                    {followUps.map((s) => <li key={s}><Chip label={s} onClick={() => send(s)} /></li>)}
                  </ul>
                )}
              </>
            )}
          </div>
          {!stuck && items.length > 0 && (
            <button type="button" onClick={() => { setStick(true); scrollToEnd(); }}
              className={cn("absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-stone-400 bg-stone-900 px-3 py-1 font-mono text-[11px] text-[#F6F4EF] shadow-md hover:bg-stone-700", FOCUS)}>
              <ArrowDown className="size-3" />New messages
            </button>
          )}
        </div>

        <Composer status={status} focusSignal={open} mac={mac} lockedUntil={lockedUntil} onSend={send} onStop={onStop} />
      </motion.aside>
    </>
  );
}
