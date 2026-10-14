"use client";

import Link from "next/link";
import { createElement, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Loader2, Play, Wrench } from "lucide-react";
import { toast } from "sonner";
import { track } from "@vercel/analytics";
import { runNow } from "@/lib/api-client";
import type { Agent, AgentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { relTime, fullTime } from "@/components/time";
import { renderSlack } from "@/components/slack-message";
import { Pulse, StatusMorph, SPRING, type Tone } from "@/components/motion";
import { Term } from "@/components/explain";
import { FOCUS } from "@/components/ui-tokens";
import { RunStrip } from "./run-strip";
import { latestRepairAt } from "./run-history";
import { agentIcon, planLine } from "./agent-icon";
import { ChainChip } from "./chain-chip";
import { AgentStatusLine } from "./agent-status-line";

const EDGE: Record<AgentStatus, string> = {
  live: "border-stone-300",
  paused: "border-stone-300",
  building: "border-sky-300",
  testing: "border-sky-300",
  ready: "border-sky-300",
  broken: "border-red-300",
  needs_human: "border-red-400",
  repairing: "border-amber-400",
};

const PULSE_TONE: Record<AgentStatus, Tone> = {
  live: "emerald",
  paused: "stone",
  building: "sky",
  testing: "sky",
  ready: "sky",
  broken: "red",
  needs_human: "red",
  repairing: "amber",
};

const ICON_TILE: Record<AgentStatus, string> = {
  live: "bg-stone-900 text-[#F6F4EF]",
  paused: "bg-stone-200 text-stone-500",
  building: "bg-sky-100 text-sky-800",
  testing: "bg-sky-100 text-sky-800",
  ready: "bg-sky-100 text-sky-800",
  broken: "bg-red-100 text-red-700",
  needs_human: "bg-red-100 text-red-700",
  repairing: "bg-amber-100 text-amber-800",
};

function SlackBubble({ agent, now }: { agent: Agent; now: number }) {
  const out = agent.lastOutput;
  if (!out) {
    return (
      <p className="rounded-[4px] border border-dashed border-stone-300 px-3 py-2.5 text-[13px] text-stone-500">
        Nothing sent yet. Its first message will show up here.
      </p>
    );
  }
  return (
    <figure className="relative rounded-[4px] border border-stone-200 bg-white px-3 py-2.5">
      <figcaption className="flex items-baseline gap-2 text-[12px]">
        <span className="font-semibold text-stone-900">Last message</span>
        <time dateTime={out.at} title={fullTime(out.at)} className="font-mono tabular-nums text-stone-500">
          {relTime(out.at, now)}
        </time>
      </figcaption>
      <blockquote className="mt-1 line-clamp-2 whitespace-pre-line text-[13px] leading-snug text-stone-800 [overflow-wrap:anywhere]">
        {renderSlack(out.message)}
      </blockquote>
    </figure>
  );
}

function Detail({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span className="whitespace-nowrap" title={title}>
      {children}
    </span>
  );
}

export function AgentCard({ agent: a, now }: { agent: Agent; now: number }) {
  const [pending, setPending] = useState(false);
  const canRun = a.status !== "building" && a.status !== "testing" && a.currentVersion != null;
  const repairedAt = latestRepairAt(a.recent);

  async function onRun() {
    setPending(true);
    try {
      await runNow(a.id);
      track("run_now");
      toast.success("Run started", { description: a.name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start run");
    } finally {
      setPending(false);
    }
  }

  return (
    <Pulse trigger={a.status} tone={PULSE_TONE[a.status]} radius={4} className="flex h-full w-full">
      <article
        aria-labelledby={`agent-${a.id}-name`}
        className={cn(
          "group relative flex h-full w-full flex-col gap-3.5 rounded-[4px] border bg-[#FBFAF7] p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] duration-200 hover:shadow-[0_6px_18px_-12px_rgba(41,37,36,0.35)]",
          EDGE[a.status],
        )}
      >
        {repairedAt && (
          <span
            className="absolute -top-px right-4 inline-flex items-center gap-1 rounded-b-[4px] bg-violet-600 px-2 py-1 text-[11px] font-medium text-white"
            title={`${a.repairs} automatic fix${a.repairs === 1 ? "" : "es"} · last ${fullTime(repairedAt)}`}
          >
            <Wrench className="size-3" aria-hidden />
            <Term id="repair" className="text-white">Repaired</Term>
            <span className="font-mono tabular-nums">{relTime(repairedAt, now)}</span>
          </span>
        )}

        <header className="flex items-start gap-3 pr-2">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-[6px]", ICON_TILE[a.status])} aria-hidden>
            {createElement(agentIcon(a), { className: "size-5", strokeWidth: 1.75 })}
          </span>
          <div className={cn("min-w-0 flex-1", repairedAt && "pt-4 sm:pt-0 sm:pr-28")}>
            <h3 id={`agent-${a.id}-name`} className="text-[18px] font-semibold leading-tight tracking-tight text-stone-900">
              <Link href={`/agents/${a.id}`} className={cn("rounded-[2px] hover:underline underline-offset-4", FOCUS)}>
                {a.name}
              </Link>
            </h3>
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-stone-600">{planLine(a)}</p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <StatusMorph status={a.status} />
          <AgentStatusLine agent={a} now={now} />
        </div>
        <ChainChip chains={a.chains} />

        <SlackBubble agent={a} now={now} />

        <div className="flex items-end justify-between gap-3">
          <RunStrip recent={a.recent} />
          <span className="text-[11px] text-stone-500">
            last {a.recent?.length ?? 0} <Term id="run">runs</Term>
          </span>
        </div>

        <footer className="mt-auto flex flex-col gap-3 border-t border-stone-200 pt-3">
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-stone-500">
            <Detail title="Share of recent runs that worked">
              <Term id="health">Worked</Term>{" "}
              <span className="font-mono tabular-nums text-stone-800">{a.runs ? `${Math.round(a.successRate * 100)}%` : "—"}</span>
            </Detail>
            <Detail>
              <Term id="cost">Cost</Term> <span className="font-mono tabular-nums text-stone-800">${a.costUsd.toFixed(4)}</span>
            </Detail>
            {a.usefulRate != null && (
              <Detail>
                <Term id="useful">👍 rate</Term>{" "}
                <span className="font-mono tabular-nums text-stone-800">{Math.round(a.usefulRate * 100)}%</span>
              </Detail>
            )}
            <Detail title={fullTime(a.nextRunAt)}>
              Next{" "}
              <span className="font-mono tabular-nums text-stone-800">
                {a.status === "paused" || !a.nextRunAt ? "—" : +new Date(a.nextRunAt) < now ? "due now" : relTime(a.nextRunAt, now)}
              </span>
            </Detail>
            {a.currentVersion != null && (
              <Detail>
                <Term id="version">
                  <span className="font-mono">v{a.currentVersion}</span>
                </Term>
              </Detail>
            )}
          </p>
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={onRun}
              disabled={pending || !canRun}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-stone-400 bg-white px-3.5 text-[13px] font-medium text-stone-900 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-[#F6F4EF] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-stone-900",
                FOCUS,
              )}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
              {pending ? "Starting…" : "Run now"}
            </motion.button>
            <Link
              href={`/agents/${a.id}`}
              className={cn(
                "ml-auto inline-flex h-9 items-center gap-1 rounded-[4px] px-2 text-[13px] font-medium text-stone-700 transition-colors hover:text-stone-900",
                FOCUS,
              )}
              aria-label={`Open ${a.name}`}
            >
              Open
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </footer>
      </article>
    </Pulse>
  );
}
