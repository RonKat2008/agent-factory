"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Hammer, Loader2, PartyPopper, Play, RotateCcw, Rocket, Wrench } from "lucide-react";
import { BTN, BTN_PRIMARY, BTN_SECONDARY, FOCUS, LABEL, PANEL } from "@/components/ui-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AcmePreview } from "./acme-preview";
import { RepairTimeline } from "./repair-timeline";
import { SlackPost } from "./slack-post";
import { useTour } from "./use-tour";

const SKEW_MS = 1500;

function mmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function Step({ n, title, children, active }: { n: number; title: string; children: ReactNode; active?: boolean }) {
  return (
    <section aria-labelledby={`step-${n}`} className={cn(PANEL, "p-4 sm:p-5", active && "border-stone-900")}>
      <header className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-[28px] font-semibold leading-none tabular-nums text-stone-300">{n}</span>
        <h2 id={`step-${n}`} className="text-[17px] font-semibold tracking-tight text-stone-900">{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function TourPanel() {
  const t = useTour();
  const { snap, watcher } = { snap: t.snap, watcher: t.snap?.watcher ?? null };
  const busy = t.pending !== null;
  const cool = (a: "break" | "publish" | "reset") =>
    t.cooldownAction === a ? (
      <p role="status" className="mt-2 rounded-[3px] border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
        Someone just did this, try again in <span className="font-mono tabular-nums">{t.cooldownSec}s</span>.
      </p>
    ) : null;

  const publishMsgs = t.publishedAt
    ? t.outbox.filter((m) => Date.parse(m.createdAt) >= Date.parse(t.publishedAt!) - SKEW_MS && !/I fixed|I couldn't fix/.test(m.body))
    : [];
  const repairPost = t.repaired
    ? (t.outbox.find((m) => Date.parse(m.createdAt) >= Date.parse(t.startedAt!) - SKEW_MS && /I fixed/.test(m.body)) ?? null)
    : null;
  const diagnosis = t.repaired?.message.replace(/^Fixed:\s*/, "").replace(/\.?\s*Shipped v\d+.*$/, "") ?? "";
  const running = t.startedAt !== null && !t.repaired && !t.stuck;

  return (
    <div className="mx-auto max-w-[1040px] space-y-4">
      <header className="space-y-1.5 pb-1">
        <p className={LABEL}>guided demo · no login</p>
        <h1 className="t-title text-[32px]">The 60-second tour</h1>
        <p className="max-w-[62ch] text-[14.5px] leading-relaxed text-stone-600">
          Acme is a fake competitor. One of our agents has been watching its changelog all day. Break Acme&apos;s website and watch the factory fix its own agent, with no human involved.
        </p>
      </header>

      {t.loadError && !snap && (
        <p role="alert" className="rounded-[3px] border border-red-300 bg-red-50 px-3 py-2 font-mono text-xs text-red-800">{t.loadError}</p>
      )}
      {snap && !watcher && (
        <p role="alert" className="rounded-[3px] border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          The demo watcher agent hasn&apos;t been seeded yet, so the tour can&apos;t run here.
        </p>
      )}

      <Step n={1} title="Break Acme's website" active={t.startedAt === null}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-3 sm:max-w-[400px]">
            <p className="text-[13.5px] leading-relaxed text-stone-600">
              Acme will &quot;redesign&quot;: the changelog moves to a new URL and the old one returns 404. Our watcher still points at the old address.
            </p>
            <button
              type="button"
              disabled={busy || !watcher}
              onClick={() => void t.act("break")}
              className={cn(BTN_PRIMARY, "h-11 px-5 text-[15px]")}
            >
              {t.pending === "break" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Hammer className="size-4" aria-hidden />}
              {t.pending === "break" ? "Breaking…" : "Break Acme's website"}
            </button>
            {cool("break")}
          </div>
          <AcmePreview refreshKey={t.previewKey} broken={snap ? snap.acme.broken : null} />
        </div>
      </Step>

      <Step n={2} title="Watch the repair" active={running}>
        {t.startedAt === null ? (
          <p className="text-[13.5px] text-stone-500">Waiting for step 1. The agent&apos;s steps will appear here live.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              {t.events.length === 0 && !t.stuck ? (
                <div className="space-y-2"><Skeleton className="h-8 rounded-[3px]" /><Skeleton className="h-8 w-2/3 rounded-[3px]" /></div>
              ) : (
                <RepairTimeline events={t.events} startedAt={Date.parse(t.startedAt)} waiting={running} />
              )}
            </div>
            <div className="md:text-right">
              <p className={LABEL}>{running ? "elapsed" : "total"}</p>
              <p aria-live="off" className={cn("font-mono text-[40px] font-semibold leading-none tabular-nums", t.repaired ? "celebrate-glow text-violet-600" : t.stuck ? "text-red-600" : "text-stone-900")}>
                {mmss(t.elapsedMs)}
              </p>
            </div>
          </div>
        )}

        {t.repaired && t.startedAt && (
          <div className="celebrate-in mt-4 space-y-3 rounded-[3px] border border-violet-300 border-l-4 border-l-violet-600 bg-violet-50/70 p-4">
            <p className="flex items-center gap-2 text-[18px] font-semibold text-violet-900">
              <PartyPopper className="size-5" aria-hidden />
              <span>
                Fixed in <span className="font-mono tabular-nums">{Math.max(1, Math.round(t.elapsedMs / 1000))}s</span>, no human involved
              </span>
            </p>
            <p className="text-[13.5px] leading-relaxed text-stone-700">
              <span className={LABEL}>diagnosis</span><br />
              {diagnosis || t.repaired.message}
            </p>
            <Link href={`/agents/${watcher!.id}`} className={cn(BTN_PRIMARY, "w-fit bg-violet-700 hover:bg-violet-600 active:scale-[0.97]")}>
              See the diff <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <div>
              <p className={cn(LABEL, "mb-1.5")}>what the team received in Slack</p>
              {repairPost ? <SlackPost message={repairPost} label="#competitive-intel" /> : <Skeleton className="h-16 rounded-[3px]" />}
            </div>
          </div>
        )}

        {t.stuck && (
          <div role="alert" className="mt-4 rounded-[3px] border border-red-300 border-l-4 border-l-red-600 bg-red-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-red-800"><Wrench className="size-4" aria-hidden /> The factory couldn&apos;t fix this one on its own</p>
            <p className="mt-1 text-[13.5px] text-red-900">{t.stuck.message}</p>
            <p className="mt-1 text-[12.5px] text-stone-600">That&apos;s the honest outcome: it escalates to a human instead of guessing. You can reset the demo below and try again.</p>
          </div>
        )}
      </Step>

      <Step n={3} title="Make it ship something">
        <div className="space-y-3">
          <p className="text-[13.5px] leading-relaxed text-stone-600">
            Acme publishes a new release. The repaired agent should notice and post a summary, using the patched URL.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !watcher} onClick={() => void t.act("publish")} className={BTN_SECONDARY}>
              {t.pending === "publish" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Rocket className="size-3.5" aria-hidden />}
              Publish a new Acme release
            </button>
            <button type="button" disabled={busy || !watcher} onClick={() => void t.runWatcher()} className={BTN_PRIMARY}>
              {t.pending === "run" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
              Run now
            </button>
          </div>
          {cool("publish")}
          {t.publishedAt && publishMsgs.length === 0 && (
            <p className="flex items-center gap-2 text-[13px] text-stone-500"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Release published. Press Run now and the post will land here.</p>
          )}
          {publishMsgs[0] && <SlackPost message={publishMsgs[0]} label="#competitive-intel" />}
        </div>
      </Step>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-300 pt-3 text-[13px]">
        <button type="button" disabled={busy} onClick={() => void t.act("reset")} className={cn(BTN, "h-auto px-0 py-1 text-stone-500 underline underline-offset-2 hover:text-stone-900")}>
          <RotateCcw className="size-3" aria-hidden /> Reset the demo
        </button>
        <span className="ml-auto flex gap-5">
          <Link href="/new" className={cn("font-medium text-stone-900 hover:underline", FOCUS)}>Build your own agent →</Link>
          <Link href="/fleet" className={cn("font-medium text-stone-900 hover:underline", FOCUS)}>Fleet →</Link>
        </span>
      </footer>
    </div>
  );
}
