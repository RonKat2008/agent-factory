"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowRight, Hammer, Loader2, PartyPopper, Play, RotateCcw, Rocket, Wrench } from "lucide-react";
import { BTN, BTN_PRIMARY, BTN_SECONDARY, FOCUS, LABEL, PANEL } from "@/components/ui-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DISTANCE, DURATION, EASE, FadeIn, NumberTicker, SPRING, Stagger, StaggerItem, StatusMorph } from "@/components/motion";
import { Term } from "@/components/explain";
import type { AgentStatus } from "@/lib/types";
import { AcmePreview } from "./acme-preview";
import { RepairTimeline } from "./repair-timeline";
import { SlackPost } from "./slack-post";
import { useTour } from "./use-tour";

const SKEW_MS = 1500;
const TOUR_SEEN_KEY = "af_tour_seen";

/** Plain-language status of the watcher during the tour, derived from the live event stream. */
function watcherStatus(events: { type: string }[], fallback: AgentStatus, started: boolean): AgentStatus {
  if (!started) return fallback === "broken" || fallback === "repairing" ? "live" : fallback;
  const types = new Set(events.map((e) => e.type));
  if (types.has("needs_human")) return "needs_human";
  if (types.has("repaired")) return "live";
  if (types.has("repairing") || types.has("self_fixed") || types.has("tests_passed")) return "repairing";
  return "broken";
}

function mmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function Step({ n, title, children, active, right }: { n: number; title: string; children: ReactNode; active?: boolean; right?: ReactNode }) {
  return (
    <StaggerItem as="section">
      <div aria-labelledby={`step-${n}`} role="group" className={cn(PANEL, "p-5 transition-colors sm:p-6", active && "border-stone-900")}>
        <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span aria-hidden className="font-mono text-[28px] font-semibold leading-none tabular-nums text-stone-300">{n}</span>
          <h2 id={`step-${n}`} className="text-[17px] font-semibold tracking-tight text-stone-900">{title}</h2>
          {right ? <span className="ml-auto">{right}</span> : null}
        </header>
        {children}
      </div>
    </StaggerItem>
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
  const status = watcherStatus(t.events, watcher?.status ?? "live", t.startedAt !== null);
  const repairedId = t.repaired?.id ?? null;

  useEffect(() => {
    if (!repairedId) return;
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch {
      /* storage unavailable: fine */
    }
  }, [repairedId]);

  return (
    <Stagger gap="normal" className="mx-auto max-w-[1040px] space-y-6 py-4">
      <StaggerItem as="section">
        <header className="space-y-2">
          <h1 className="t-title text-[32px]">The 60-second tour</h1>
          <p className="max-w-[62ch] text-[15px] leading-relaxed text-stone-600">
            Watch an agent break, fix itself, and get back to work. No setup needed.
          </p>
        </header>
      </StaggerItem>

      {t.loadError && !snap && (
        <p role="alert" className="rounded-[3px] border border-red-300 bg-red-50 px-3 py-2 font-mono text-xs text-red-800">{t.loadError}</p>
      )}
      {snap && !watcher && (
        <p role="alert" className="rounded-[3px] border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          The demo watcher agent hasn&apos;t been seeded yet, so the tour can&apos;t run here.
        </p>
      )}

      <Step n={1} title="Meet the agent" active={t.startedAt === null}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-3 sm:max-w-[420px]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold text-stone-900">{watcher?.name ?? "Competitor watcher"}</p>
              <StatusMorph status={status} />
            </div>
            <p className="text-[14px] leading-relaxed text-stone-600">
              Acme is a fake competitor. This agent has been watching its changelog all day and posting what&apos;s new to Slack. Right now it&apos;s working fine.
            </p>
          </div>
          <AcmePreview refreshKey={t.previewKey} broken={snap ? snap.acme.broken : null} />
        </div>
      </Step>

      <Step n={2} title="Break it, watch it fix itself" active={running} right={t.startedAt !== null ? <StatusMorph status={status} /> : null}>
        <div className="space-y-3">
          <p className="max-w-[60ch] text-[14px] leading-relaxed text-stone-600">
            Acme will &quot;redesign&quot;: the changelog moves to a new URL and the old one returns 404. Our watcher still points at the old address, so it breaks. Then the factory notices, diagnoses it, and <Term id="repair">fixes</Term> it.
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

        {t.startedAt === null ? (
          <p className="mt-5 text-[13.5px] text-stone-500">The agent&apos;s steps will appear here live.</p>
        ) : (
          <div className="mt-5 grid gap-4 border-t border-stone-200 pt-5 md:grid-cols-[minmax(0,1fr)_auto]">
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
          <div className="relative mt-5">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-6 -z-0 rounded-[40px] bg-[radial-gradient(closest-side,rgb(124_58_237/0.28),transparent)]"
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 0 }}
              transition={{ duration: DURATION.crawl, ease: EASE.out }}
            />
            <motion.div
              initial={{ opacity: 0, y: DISTANCE.lg * 0.67, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={SPRING.gentle}
              className="relative z-10 space-y-3 rounded-[3px] border border-violet-300 border-l-4 border-l-violet-600 bg-violet-50 p-4"
            >
              <p className="flex items-center gap-2 text-[18px] font-semibold text-violet-900">
                <PartyPopper className="size-5" aria-hidden />
                <span>
                  <Term id="repair">Fixed</Term> in{" "}
                  <NumberTicker className="font-mono tabular-nums" value={Math.max(1, Math.round(t.elapsedMs / 1000))} from={0} format={(n) => `${Math.round(n)}s`} />, no human involved
                </span>
              </p>
              <p className="text-[13.5px] leading-relaxed text-stone-700">
                <span className={LABEL}>what went wrong</span><br />
                {diagnosis || t.repaired.message}
              </p>
              <Link href={`/agents/${watcher!.id}`} className={cn(BTN_SECONDARY, "w-fit border-violet-300 text-violet-900 hover:bg-violet-100 active:scale-[0.97]")}>
                See what changed <ArrowRight className="size-3.5" aria-hidden />
              </Link>
              <FadeIn delay={DURATION.normal}>
                <p className={cn(LABEL, "mb-1.5")}>what the team received in Slack</p>
                {repairPost ? <SlackPost message={repairPost} label="#competitive-intel" /> : <Skeleton className="h-16 rounded-[3px]" />}
                <p className="mt-1.5 text-[12px] text-stone-500">
                  The fix also added a <Term id="regression-test">new check</Term> so this exact problem gets caught next time.
                </p>
              </FadeIn>
            </motion.div>
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

      <Step n={3} title="See it work again">
        <div className="space-y-3">
          <p className="text-[13.5px] leading-relaxed text-stone-600">
            Acme publishes a new release. The repaired agent should notice and post a summary, using the patched URL.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !watcher} onClick={() => void t.act("publish")} className={BTN_SECONDARY}>
              {t.pending === "publish" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Rocket className="size-3.5" aria-hidden />}
              Publish a new Acme release
            </button>
            <button type="button" disabled={busy || !watcher} onClick={() => void t.runWatcher()} className={BTN_SECONDARY}>
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

      <StaggerItem as="div"><footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-300 pt-3 text-[13px]">
        <button type="button" disabled={busy} onClick={() => void t.act("reset")} className={cn(BTN, "h-auto px-0 py-1 text-stone-500 underline underline-offset-2 hover:text-stone-900")}>
          <RotateCcw className="size-3" aria-hidden /> Reset the demo
        </button>
        <span className="ml-auto flex gap-5">
          <Link href="/" className={cn("font-medium text-stone-900 hover:underline", FOCUS)}>Build your own agent →</Link>
          <Link href="/fleet" className={cn("font-medium text-stone-900 hover:underline", FOCUS)}>My agents →</Link>
        </span>
      </footer></StaggerItem>
    </Stagger>
  );
}
