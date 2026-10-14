"use client";

import { MessageSquareText } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getAgents } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { FOCUS } from "../ui-tokens";
import type { AgentRef } from "./markdown";
import { OpsPanel } from "./ops-panel";
import { useOpsChat } from "./use-ops-chat";

const subscribeNone = () => () => {};

/** Top-bar button + slide-over. Mounted once, so the chat survives closing the panel (and reloads, via sessionStorage). */
export function AskOps() {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentRef[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const mounted = useSyncExternalStore(subscribeNone, () => true, () => false);
  const mac = useSyncExternalStore(subscribeNone, () => /Mac|iPhone|iPad/.test(navigator.platform), () => true);
  const chat = useOpsChat();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Other pages (the tour) open the panel with a question: window.dispatchEvent(new CustomEvent("ops:open", { detail: { prompt } })).
  const sendRef = useRef(chat.send);
  const statusRef = useRef(chat.status);
  useEffect(() => {
    sendRef.current = chat.send;
    statusRef.current = chat.status;
  });
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const prompt = (e as CustomEvent<{ prompt?: unknown }>).detail?.prompt;
      if (typeof prompt === "string" && prompt.trim() && statusRef.current === "idle") void sendRef.current(prompt.trim());
    };
    window.addEventListener("ops:open", onOpen);
    return () => window.removeEventListener("ops:open", onOpen);
  }, []);

  // Agent names in answers become chips; refresh the list each time the panel opens.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getAgents()
      .then((list) => { if (alive) setAgents(list.map((a) => ({ id: a.id, name: a.name, status: a.status }))); })
      .catch(() => { /* chips are optional */ });
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K"
        className={cn("inline-flex h-8 shrink-0 items-center gap-2 rounded-[3px] border border-stone-300 bg-[#FBFAF7] px-2.5 text-[14px] text-stone-800 transition-colors hover:border-stone-500 hover:bg-white active:scale-[0.97]", FOCUS)}>
        <MessageSquareText className="size-4" aria-hidden />
        Ask Ops
        <kbd className="hidden rounded-[2px] border border-stone-300 bg-stone-100 px-1 font-mono text-[10.5px] text-stone-500 md:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      {/* Portal: the header has backdrop-filter, which would otherwise trap position:fixed inside it. */}
      {mounted && createPortal(
        <OpsPanel open={open} onClose={close} items={chat.items} status={chat.status} agents={agents} mac={mac}
          onSend={chat.send} onStop={chat.stop} onRetry={chat.retry} onAnswer={chat.respond} onReset={chat.reset} />,
        document.body,
      )}
    </>
  );
}
