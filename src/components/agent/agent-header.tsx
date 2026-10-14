import { Info, Wrench } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import type { Agent, AgentVersion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentActions } from "./agent-actions";
import { EveExport } from "./eve-export";
import { LABEL, fullTime, relTime, usd } from "./format";

function Stat({
  label,
  children,
  tone,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={cn(LABEL, "group relative inline-flex w-fit items-center gap-1")}>
        {label}
        {hint && (
          <>
            <button
              type="button"
              aria-label={`What is ${label.toLowerCase()}?`}
              aria-describedby={`hint-${label}`}
              className="rounded-full text-stone-400 hover:text-stone-900 focus-visible:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
            >
              <Info className="size-3" aria-hidden />
            </button>
            <span
              id={`hint-${label}`}
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-56 rounded-[3px] bg-stone-900 px-2 py-1.5 font-sans text-[12px] normal-case leading-snug tracking-normal text-[#F6F4EF] opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            >
              {hint}
            </span>
          </>
        )}
      </span>
      <span className={cn("font-mono text-[22px] leading-none tabular-nums text-stone-900", tone)}>{children}</span>
    </div>
  );
}

export function AgentHeader({
  agent,
  versions,
  onChanged,
}: {
  agent: Agent;
  versions: AgentVersion[];
  onChanged: () => void;
}) {
  const versionCount = versions.filter((v) => v.status !== "rejected").length;
  const healthTone = agent.health >= 80 ? "text-emerald-700" : agent.health >= 50 ? "text-amber-700" : "text-red-700";
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-stone-900">{agent.name}</h1>
        <StatusPill status={agent.status} />
        {agent.currentVersion != null && (
          <span className="flex items-center gap-1.5 font-mono text-[12px] tabular-nums text-stone-500">
            <span className="rounded-[3px] border border-stone-300 bg-stone-100 px-1.5 py-0.5 text-stone-700">
              v{agent.currentVersion}
            </span>
            {versionCount > 1 && <span>· {versionCount} versions</span>}
            {agent.repairs > 0 && (
              <span className="text-violet-700">
                · repaired {agent.repairs}×
              </span>
            )}
          </span>
        )}
      </div>
      <p className="max-w-3xl text-[14px] italic text-stone-500">&ldquo;{agent.request}&rdquo;</p>
      <div className="flex flex-wrap items-start gap-2" role="group" aria-label="Agent actions">
        <AgentActions agent={agent} onChanged={onChanged} />
        <span className="hidden h-8 w-px bg-stone-300 sm:block" aria-hidden />
        <EveExport agentId={agent.id} />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-stone-300 py-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={LABEL}>Schedule</span>
          <span className="text-[13px] text-stone-900">{agent.scheduleHuman}</span>
          <span className="font-mono text-[12px] tabular-nums text-stone-500" title={fullTime(agent.nextRunAt)}>
            {agent.status === "paused" ? "paused" : `next ${relTime(agent.nextRunAt)}`}
          </span>
        </div>
        <Stat label="Health" tone={healthTone} hint="Pass rate of the last 20 runs. 100 means every recent run succeeded.">
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
