"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAgents, getOutbox } from "@/lib/api-client";
import type { OutboxMessage } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { fullTime, relTime } from "@/components/time";
import { BTN_PRIMARY, LABEL, PANEL } from "@/components/ui-tokens";
import { Term } from "@/components/explain";
import { FadeIn, LayoutList } from "@/components/motion";
import { renderSlack } from "@/components/slack-message";

const POLL_MS = 5000;

function dayLabel(iso: string, now: number): string {
  const d = new Date(iso);
  const start = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const diff = Math.round((start(new Date(now)) - start(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function EmptyOutbox() {
  return (
    <div className={`${PANEL} flex flex-col items-center gap-4 px-6 py-14 text-center`}>
      <svg width="120" height="84" viewBox="0 0 120 84" fill="none" aria-hidden>
        <path d="M14 46h28l6 12h24l6-12h28" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 46 28 14h64l14 32v26a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4Z" stroke="#78716c" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M60 4v14M52 12l8-8 8 8" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 5" />
      </svg>
      <div className="space-y-1.5">
        <p className="text-[17px] font-semibold text-stone-900">Nothing sent yet</p>
        <p className="max-w-[40ch] text-[14px] leading-relaxed text-stone-600">When your agents post, every message shows up here.</p>
      </div>
      <Link href="/fleet" className={`${BTN_PRIMARY} h-11 px-5 text-[15px]`}>See my agents</Link>
    </div>
  );
}

function groupByDay(messages: OutboxMessage[], now: number) {
  const groups: { label: string; items: OutboxMessage[] }[] = [];
  for (const m of messages) {
    const label = dayLabel(m.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m);
    else groups.push({ label, items: [m] });
  }
  return groups;
}

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
    <div className="mx-auto w-full max-w-3xl space-y-6 py-2">
      <FadeIn>
        <h1 className="t-title"><Term id="outbox">Outbox</Term></h1>
        <p className="t-lede mt-2 max-w-[60ch]">
          Every message your agents sent, and the ones <Term id="held-post">waiting for your OK</Term>.
        </p>
      </FadeIn>
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
        <EmptyOutbox />
      ) : (
        <div className="space-y-5">
          {groupByDay(messages, now).map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="sticky top-14 z-10 mb-2 flex items-center gap-3 bg-[#F6F4EF]/90 py-1 backdrop-blur-sm">
                <span className="rounded-full border border-stone-300 bg-[#FBFAF7] px-3 py-0.5 text-[12px] font-semibold text-stone-800">{g.label}</span>
                <span className="h-px flex-1 bg-stone-300" aria-hidden />
              </h2>
              <LayoutList
                as="ol"
                enterFrom="top"
                className={`${PANEL} divide-y divide-stone-200`}
                items={g.items}
                getKey={(m) => m.id}
                renderItem={(m) => {
                  const name = m.agentId ? (names[m.agentId] ?? m.agentId.slice(0, 8)) : "Agent Factory";
                  return (
                    <div className="group flex min-w-0 gap-3 px-4 py-4 transition-colors hover:bg-white">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-[4px] bg-stone-900 font-mono text-[15px] font-semibold uppercase text-[#F6F4EF]"
                        aria-hidden
                      >
                        {name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {m.agentId ? (
                            <Link
                              href={`/agents/${m.agentId}`}
                              className="rounded-[2px] text-[14px] font-bold text-stone-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60"
                            >
                              {name}
                            </Link>
                          ) : (
                            <span className="text-[14px] font-bold text-stone-900">{name}</span>
                          )}
                          <span className="rounded-[2px] bg-stone-200 px-1 font-mono text-[10px] font-semibold leading-[1.5] text-stone-600">APP</span>
                          <time
                            dateTime={m.createdAt}
                            title={fullTime(m.createdAt)}
                            className="font-mono text-[11px] tabular-nums text-stone-500"
                          >
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {relTime(m.createdAt, now)}
                          </time>
                          <span className={`ml-auto font-mono text-[11px] uppercase tracking-[0.12em] ${m.sentOk ? "text-emerald-600" : "text-red-600"}`}>
                            {m.sentOk ? "Delivered" : "Didn't send"}
                          </span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-stone-800">
                          {renderSlack(m.body)}
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
            </section>
          ))}
        </div>
      )}
      <p className={LABEL}>Polling every 5s</p>
    </div>
  );
}
