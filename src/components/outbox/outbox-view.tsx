"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { getAgents, getOutbox } from "@/lib/api-client";
import type { OutboxMessage } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { fullTime, relTime } from "@/components/time";
import { LABEL, PANEL } from "@/components/ui-tokens";
import { renderSlack } from "./slack-text";

const POLL_MS = 5000;

export function OutboxView() {
  const [messages, setMessages] = useState<OutboxMessage[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [msgs, agents] = await Promise.all([getOutbox(), getAgents().catch(() => null)]);
        if (!alive) return;
        const sorted = [...msgs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        setMessages(sorted);
        if (agents) setNames(Object.fromEntries(agents.map((a) => [a.id, a.name])));
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Outbox unavailable");
      }
      if (alive) setNow(Date.now());
    }
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Outbox</h1>
        <p className="mt-1 text-[13px] text-stone-500">
          Every message the fleet sent to Slack, in order. Same content, even if Slack is down.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-[3px] border border-red-300 bg-red-50 px-3 py-2 font-mono text-xs text-red-800">
          Connection problem: {error}. Showing last known data.
        </p>
      )}
      {messages === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-[3px]" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <p className={`${PANEL} px-3 py-10 text-center text-sm text-stone-500`}>No messages sent yet.</p>
      ) : (
        <ol className="space-y-2">
          {messages.map((m) => {
            const name = m.agentId ? names[m.agentId] : undefined;
            return (
              <li key={m.id} className={`${PANEL} flex min-w-0 gap-3 p-3`}>
                <span className="grid size-8 shrink-0 place-items-center rounded-[3px] bg-stone-900 text-[#F6F4EF]" aria-hidden>
                  <Hash className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {m.agentId ? (
                      <Link href={`/agents/${m.agentId}`} className="text-[13px] font-semibold text-stone-900 hover:underline">
                        {name ?? m.agentId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-semibold text-stone-900">Agent Factory</span>
                    )}
                    <time
                      dateTime={m.createdAt}
                      title={fullTime(m.createdAt)}
                      className="font-mono text-[11px] tabular-nums text-stone-500"
                    >
                      {new Date(m.createdAt).toLocaleTimeString([], { hour12: false })} · {relTime(m.createdAt, now)}
                    </time>
                    <span
                      className={`ml-auto font-mono text-[11px] uppercase tracking-[0.12em] ${
                        m.sentOk ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {m.sentOk ? "delivered" : "failed"}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-stone-800">
                    {renderSlack(m.body)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className={LABEL}>Polling every 5s</p>
    </div>
  );
}
