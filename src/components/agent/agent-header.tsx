import { Wrench } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EveExport } from "./eve-export";
import { LABEL, fullTime, relTime, usd } from "./format";

function Stat({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={LABEL}>{label}</span>
      <span className={cn("font-mono text-[22px] leading-none tabular-nums text-stone-900", tone)}>{children}</span>
    </div>
  );
}

export function AgentHeader({ agent }: { agent: Agent }) {
  const healthTone = agent.health >= 80 ? "text-emerald-700" : agent.health >= 50 ? "text-amber-700" : "text-red-700";
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-stone-900">{agent.name}</h1>
        <StatusPill status={agent.status} />
        {agent.currentVersion != null && (
          <span className="rounded-[3px] border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono text-[12px] tabular-nums text-stone-700">
            v{agent.currentVersion}
          </span>
        )}
      </div>
      <p className="max-w-3xl text-[14px] italic text-stone-500">&ldquo;{agent.request}&rdquo;</p>
      <EveExport agentId={agent.id} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-stone-300 py-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={LABEL}>Schedule</span>
          <span className="text-[13px] text-stone-900">{agent.scheduleHuman}</span>
          <span className="font-mono text-[12px] tabular-nums text-stone-500" title={fullTime(agent.nextRunAt)}>
            {agent.status === "paused" ? "paused" : `next ${relTime(agent.nextRunAt)}`}
          </span>
        </div>
        <Stat label="Health" tone={healthTone}>
          {Math.round(agent.health)}
          <span className="text-[13px] text-stone-500">/100</span>
        </Stat>
        <Stat label="Cost">{usd(agent.costUsd)}</Stat>
        <Stat label="Runs">{agent.runs}</Stat>
        <Stat label="Repairs" tone={agent.repairs > 0 ? "text-violet-700" : undefined}>
          <span className="inline-flex items-center gap-1.5">
            {agent.repairs > 0 && <Wrench className="size-4" aria-hidden />}
            {agent.repairs}
          </span>
        </Stat>
      </div>
    </header>
  );
}
