"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, FlaskConical, Hammer, Loader2, PartyPopper, RotateCcw, Wrench } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY, LABEL } from "@/components/ui-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { DISTANCE, DURATION, EASE, FadeIn, NumberTicker, SPRING, StatusMorph } from "@/components/motion";
import { Term } from "@/components/explain";
import { relTime } from "@/components/time";
import { getFeed } from "@/lib/api-client";
import type { AgentStatus, FeedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AcmePreview } from "./acme-preview";
import { ChapterShell, Notice } from "./chapter-shell";
import { markLeavingTour } from "./chapters";
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

/** The most recent repair of the watcher, for judges who arrive after someone else broke Acme. */
function useLatestRepair(agentId: string | null, enabled: boolean): FeedEvent | null {
  const [ev, setEv] = useState<FeedEvent | null>(null);
  useEffect(() => {
    if (!agentId || !enabled) return;
    let alive = true;
    getFeed({ agentId })
      .then((all) => {
        if (!alive) return;
        const latest = all.filter((e) => e.type === "repaired").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
        setEv(latest ?? null);
      })
      .catch(() => { /* optional context */ });
    return () => { alive = false; };
  }, [agentId, enabled]);
  return ev;
}

function RepairDemo() {
  const t = useTour();
  const snap = t.snap;
  const watcher = snap?.watcher ?? null;
  const busy = t.pending !== null;
  const running = t.startedAt !== null && !t.repaired && !t.stuck;
  const status = watcherStatus(t.events, watcher?.status ?? "live", t.startedAt !== null);
  const needsReset = Boolean(snap?.acme.broken) && t.startedAt === null;
  const latestRepair = useLatestRepair(watcher?.id ?? null, needsReset);
  const repairPost = t.repaired && t.startedAt
    ? (t.outbox.find((m) => Date.parse(m.createdAt) >= Date.parse(t.startedAt!) - SKEW_MS && /I fixed|Pit stop complete/.test(m.body)) ?? null)
    : null;
  const diagnosis = t.repaired?.message.replace(/^Fixed:\s*/, "").replace(/\.?\s*Shipped v\d+.*$/, "") ?? "";
  const repairedId = t.repaired?.id ?? null;

  useEffect(() => {
    if (!repairedId) return;
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch {
      /* storage unavailable: fine */
    }
  }, [repairedId]);

  const cool = (a: "break" | "reset") =>
    t.cooldownAction === a ? (
      <Notice>
        {a === "break" ? "Someone just broke Acme, so their repair is running now. " : "Someone just reset the demo. "}
        You can try again in <span className="font-mono tabular-nums">{t.cooldownSec}s</span>.
      </Notice>
    ) : null;

  if (t.loadError && !snap) return <Notice tone="red">The demo is not reachable right now ({t.loadError}). Refresh in a moment.</Notice>;
  if (!snap) return <div className="space-y-2"><Skeleton className="h-10 rounded-[3px]" /><Skeleton className="h-40 rounded-[3px]" /></div>;
  if (!watcher) return <Notice>The demo watcher agent has not been set up on this deployment, so this chapter cannot run here.</Notice>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-3 md:max-w-[440px]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-stone-900">{watcher.name}</p>
            <StatusMorph status={t.startedAt ? status : watcher.status} />
          </div>
          <p className="text-[14px] leading-relaxed text-stone-600">
            Acme is a fake competitor. This agent reads its changelog and posts new releases to Slack. Breaking Acme moves the changelog to a new URL, so the old one returns 404 and the agent fails.
          </p>
          {needsReset ? (
            <div className="space-y-2 rounded-[3px] border border-stone-300 bg-stone-50 p-4">
              <p className="text-[14px] font-semibold text-stone-900">Someone already broke Acme{watcher.status === "live" ? ", and the agent has fixed itself." : "."}</p>
              {latestRepair && (
                <p className="text-[13.5px] text-stone-600">
                  Latest repair, {relTime(latestRepair.createdAt)}: {latestRepair.message}
                </p>
              )}
              <p className="text-[13.5px] text-stone-600">Reset Acme to watch it happen yourself.</p>
              <button type="button" disabled={busy} onClick={() => void t.act("reset")} className={BTN_SECONDARY}>
                {t.pending === "reset" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RotateCcw className="size-3.5" aria-hidden />}
                Reset and try
              </button>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => void t.act("break")} className={cn(BTN_PRIMARY, "h-11 px-5 text-[15px]")}>
              {t.pending === "break" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Hammer className="size-4" aria-hidden />}
              {t.pending === "break" ? "Breaking…" : t.repaired ? "Break it again" : "Break Acme's website"}
            </button>
          )}
          {cool("break")}
          {cool("reset")}
        </div>
        <AcmePreview refreshKey={t.previewKey} broken={snap.acme.broken} />
      </div>

      {t.startedAt !== null && (
        <div className="grid gap-4 border-t border-stone-200 pt-5 md:grid-cols-[minmax(0,1fr)_auto]">
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
        <div className="relative">
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
                <Term id="repair">Pit stop</Term>:{" "}
                <NumberTicker className="font-mono tabular-nums" value={Math.max(1, Math.round(t.elapsedMs / 1000))} from={0} format={(n) => `${Math.round(n)}s`} /> — back on track, no human involved
              </span>
              <span className="chequer" aria-hidden />
            </p>
            <p className="text-[13.5px] leading-relaxed text-stone-700">
              <span className={LABEL}>what went wrong</span><br />
              {diagnosis || t.repaired.message}
            </p>
            <Link href={`/agents/${watcher.id}`} onClick={markLeavingTour} className={cn(BTN_SECONDARY, "w-fit border-violet-300 text-violet-900 hover:bg-violet-100 active:scale-[0.97]")}>
              See the diff of what changed <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <FadeIn delay={DURATION.normal}>
              <p className={cn(LABEL, "mb-1.5")}>what the team received in Slack</p>
              {repairPost ? <SlackPost message={repairPost} label="#competitive-intel" /> : <Skeleton className="h-16 rounded-[3px]" />}
            </FadeIn>
          </motion.div>
        </div>
      )}

      {t.stuck && (
        <div role="alert" className="rounded-[3px] border border-red-300 border-l-4 border-l-red-600 bg-red-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-red-800"><Wrench className="size-4" aria-hidden /> Pitcrew could not fix this one on its own</p>
          <p className="mt-1 text-[13.5px] text-red-900">{t.stuck.message}</p>
          <p className="mt-1 text-[12.5px] text-stone-600">That is the honest outcome: it escalates to a human instead of guessing. Reset and try again.</p>
        </div>
      )}

      <div className="flex gap-3 rounded-[3px] border border-stone-300 bg-white p-3.5">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
        <p className="text-[13.5px] leading-relaxed text-stone-700">
          <span className="font-semibold text-stone-900">The failure became a regression test.</span> Every repair adds a check for the exact thing that broke, so the same break can never ship twice.{" "}
          <Link href={`/agents/${watcher.id}`} onClick={markLeavingTour} className="font-medium text-violet-800 underline underline-offset-2 hover:text-violet-950">
            Open the version history and diff
          </Link>
        </p>
      </div>

      <button type="button" disabled={busy} onClick={() => void t.act("reset")} className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 underline underline-offset-2 hover:text-stone-900 disabled:opacity-50">
        <RotateCcw className="size-3" aria-hidden /> Reset the demo
      </button>
    </div>
  );
}

export function ChapterRepair() {
  return (
    <ChapterShell
      n={2}
      title="It fixes itself"
      lede={
        <p>
          Websites change and automations break silently. Press the button to redesign Acme&apos;s site out from under a live agent. Pitcrew notices the failure, works out why, patches the agent, re-runs its tests, and only then ships the fix. Usually in under a minute.
        </p>
      }
      different={
        <p>
          Other tools help you build version one. This one takes responsibility for version two hundred: it repairs, proves the repair with tests, and tells your team in Slack what it changed and why.
        </p>
      }
      tryIt={<RepairDemo />}
      products={["Workflow DevKit", "AI Gateway", "Neon", "BotID", "Rate limits"]}
      hood={
        <>
          <p>The failed run triggers a repair workflow (Vercel Workflow DevKit), so every step is durable and resumable. Claude Sonnet through AI Gateway reads the error and the old plan and proposes a new version.</p>
          <p>The new version runs against all of the agent&apos;s tests plus a new one for this failure. It goes live only if every test passes. Versions and diffs live in Neon Postgres. This button is public, so it is protected by BotID and a shared rate limit.</p>
        </>
      }
    />
  );
}
