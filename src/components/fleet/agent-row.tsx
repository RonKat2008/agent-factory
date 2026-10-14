"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Play, Wrench } from "lucide-react";
import { toast } from "sonner";
import { runNow } from "@/lib/api-client";
import type { Agent, AgentStatus } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";
import { HealthRing } from "./health-ring";
import { relTime } from "@/components/time";

const STRIPE: Record<AgentStatus, string> = {
  live: "bg-emerald-500",
  broken: "bg-red-500",
  repairing: "bg-amber-500 animate-pulse",
  needs_human: "bg-red-600 animate-pulse",
  paused: "bg-stone-400",
  building: "bg-sky-500",
  testing: "bg-sky-500",
  ready: "bg-sky-600",
};

function Metric({ label, children, title }: { label: string; children: React.ReactNode; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[13px] tabular-nums text-stone-900">{children}</div>
    </div>
  );
}

export function AgentRow({ agent: a, now }: { agent: Agent; now: number }) {
  const [pending, setPending] = useState(false);
  const canRun = a.status !== "building" && a.status !== "testing";

  async function onRun() {
    setPending(true);
    try {
      await runNow(a.id);
      toast.success("Run started", { description: a.name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start run");
    } finally {
      setPending(false);
    }
  }

  return (
    <li
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-[3px] border bg-[#FBFAF7] py-3 pl-5 pr-3 shadow-[0_1px_0_rgba(0,0,0,0.04)] lg:flex-row lg:items-center",
        a.status === "repairing" ? "border-amber-400" : a.status === "broken" || a.status === "needs_human" ? "border-red-300" : "border-stone-300",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1.5", STRIPE[a.status])} aria-hidden />

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <HealthRing value={a.health} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/agents/${a.id}`}
              className="truncate text-[15px] font-semibold text-stone-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
            >
              {a.name}
            </Link>
            {a.currentVersion != null && (
              <span className="rounded-[2px] border border-stone-300 bg-stone-100 px-1 font-mono text-[11px] text-stone-600">
                v{a.currentVersion}
              </span>
            )}
            <StatusPill status={a.status} />
            {a.repairs > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-[2px] border border-violet-300 bg-violet-50 px-1.5 py-0.5 font-mono text-[11px] text-violet-700"
                title={`${a.repairs} automatic repair${a.repairs === 1 ? "" : "s"}`}
              >
                <Wrench className="size-3" aria-hidden /> {a.repairs} repair{a.repairs === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate font-mono text-[12px] text-stone-500" title={a.schedule}>
            {a.scheduleHuman}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-5 gap-y-2 sm:grid-cols-6 lg:flex lg:gap-x-5">
        <Metric label="Last run" title={a.lastRunAt ?? undefined}>{relTime(a.lastRunAt, now)}</Metric>
        <Metric label="Next run" title={a.nextRunAt ?? undefined}>
          {a.status === "paused" || !a.nextRunAt ? "—" : relTime(a.nextRunAt, now)}
        </Metric>
        <Metric label="Success">{a.runs ? `${Math.round(a.successRate * 100)}%` : "—"}</Metric>
        <Metric label="Cost">${a.costUsd.toFixed(4)}</Metric>
        <Metric label="Useful">{a.usefulRate == null ? "—" : `👍 ${Math.round(a.usefulRate * 100)}%`}</Metric>
        <Metric label="Runs">{a.runs}</Metric>
      </div>

      <button
        type="button"
        onClick={onRun}
        disabled={pending || !canRun}
        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[3px] border border-stone-400 bg-transparent px-3 font-mono text-[12px] uppercase tracking-wide text-stone-900 transition-colors hover:bg-stone-900 hover:text-[#F6F4EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-stone-900"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        {pending ? "Starting…" : "Run now"}
      </button>
    </li>
  );
}
