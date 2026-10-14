"use client";

import { SendHorizontal, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FOCUS } from "../ui-tokens";
import type { ChatStatus } from "./use-ops-chat";

const MAX_LINES = 6;
const LINE_PX = 20;
const VERTICAL_PAD = 18;

export function Composer({ status, focusSignal, mac, lockedUntil, onSend, onStop }: {
  status: ChatStatus; focusSignal: boolean; mac: boolean; lockedUntil: number;
  onSend: (text: string) => void; onStop: () => void;
}) {
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const busy = status !== "idle";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockedUntil]);
  const locked = lockedUntil > now;

  useEffect(() => { if (focusSignal) ref.current?.focus(); }, [focusSignal]);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_LINES * LINE_PX + VERTICAL_PAD)}px`;
  };
  const submit = () => {
    if (!draft.trim() || busy || locked) return;
    onSend(draft);
    setDraft("");
    requestAnimationFrame(grow);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="border-t border-stone-300 bg-[#FBFAF7] p-3">
      <div className="flex items-end gap-2">
        <textarea ref={ref} value={draft} rows={1} maxLength={2000} disabled={status === "awaiting-input"}
          onChange={(e) => { setDraft(e.target.value); grow(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          placeholder={status === "awaiting-input" ? "Approve or deny above to continue" : "Ask Fleet Ops…"}
          aria-label="Message Fleet Ops"
          style={{ lineHeight: `${LINE_PX}px` }}
          className={cn("min-h-[40px] flex-1 resize-none rounded-[3px] border border-stone-300 bg-white px-3 py-[9px] text-[14px] text-stone-900 placeholder:text-stone-400 disabled:bg-stone-100", FOCUS)} />
        {busy ? (
          <button type="button" onClick={onStop} aria-label="Stop" title="Stop"
            className={cn("grid size-10 shrink-0 place-items-center rounded-[3px] bg-stone-900 text-[#F6F4EF] hover:bg-stone-700", FOCUS)}><Square className="size-3.5 fill-current" /></button>
        ) : (
          <button type="submit" disabled={!draft.trim() || locked} aria-label="Send"
            className={cn("grid size-10 shrink-0 place-items-center rounded-[3px] bg-stone-900 text-[#F6F4EF] hover:bg-stone-700 disabled:opacity-40", FOCUS)}><SendHorizontal className="size-4" /></button>
        )}
      </div>
      <p className="mt-2 font-mono text-[10.5px] text-stone-400">Enter to send · Shift+Enter for a new line · {mac ? "⌘K" : "Ctrl+K"} to toggle</p>
    </form>
  );
}
