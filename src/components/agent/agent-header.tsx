"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MoreHorizontal, Wrench } from "lucide-react";
import type { Agent, AgentStatus, AgentVersion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DURATION, EASE, NumberTicker, SPRING, StatusMorph } from "@/components/motion";
import { Term } from "@/components/explain";
import type { GlossaryId } from "@/lib/glossary";
import { ChainChip } from "@/components/fleet/chain-chip";
import { AgentActions } from "./agent-actions";
import { EveExport } from "./eve-export";
import { FOCUS } from "@/components/ui-tokens";
import { fullTime, relTime, usd } from "./format";

const TROUBLE = new Set<AgentStatus>(["broken", "repairing"]);
/** How long the "fixed itself" payoff stays under the title. */
const PAYOFF_MS = 9000;

const nextLabel = (rel: string) => (rel.endsWith("ago") ? "due now" : `next ${rel}`);

function Stat({ label, term, children, tone }: { label: string; term: GlossaryId; children: React.ReactNode; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-stone-500">
        <Term id={term}>{label}</Term>
      </span>
      <span className={cn("font-mono text-[22px] leading-none tabular-nums text-stone-900", tone)}>{children}</span>
    </div>
  );
}

/** Hero moment 2, finish: the agent just went back to live after fixing itself. */
function RepairPayoff({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="payoff"
          role="status"
          className="relative w-fit max-w-full"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING.gentle }}
          exit={{ opacity: 0, transition: { duration: DURATION.normal, ease: EASE.in } }}
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.25),transparent)]"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            transition={{ duration: DURATION.crawl, ease: EASE.out }}
          />
          <p className="relative inline-flex items-center gap-2 rounded-[4px] border border-violet-300 bg-violet-50 px-3 py-2 text-[14px] text-violet-950">
            <Wrench className="size-4 text-violet-600" aria-hidden />
            <span>
              <strong className="font-semibold">
                <Term id="repair">Fixed itself</Term>
              </strong>{" "}
              and it&rsquo;s back to work. No human needed.
            </span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
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
  const [prev, setPrev] = useState(agent.status);
  const [payoff, setPayoff] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  if (agent.status !== prev) {
    setPrev(agent.status);
    if (agent.status === "live" && TROUBLE.has(prev)) setPayoff((n) => n + 1);
  }
  const [shownPayoff, setShownPayoff] = useState(0);
  useEffect(() => {
    if (payoff === 0) return;
    const t = setTimeout(() => setShownPayoff(payoff), PAYOFF_MS);
    return () => clearTimeout(t);
  }, [payoff]);

  const versionCount = versions.filter((v) => v.status !== "rejected").length;
  const healthTone = agent.health >= 80 ? "text-emerald-700" : agent.health >= 50 ? "text-amber-700" : "text-red-700";
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-stone-900">{agent.name}</h1>
        <StatusMorph status={agent.status} size="md" />
        {agent.currentVersion != null && (
          <span className="flex items-center gap-1.5 text-[12px] text-stone-500">
            <Term id="version">
              <span className="rounded-[3px] border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono tabular-nums text-stone-700">
                v{agent.currentVersion}
              </span>
            </Term>
            {versionCount > 1 && <span>{versionCount} versions</span>}
          </span>
        )}
      </div>
      <ChainChip chains={agent.chains} />
      <p className="max-w-3xl text-[15px] text-stone-700">&ldquo;{agent.request}&rdquo;</p>
      <RepairPayoff show={payoff > shownPayoff} />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Agent actions">
        <AgentActions agent={agent} onChanged={onChanged} />
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-label="More options"
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-[3px] px-2 text-[13px] text-stone-600 hover:bg-stone-100 hover:text-stone-900",
            FOCUS,
          )}
        >
          <MoreHorizontal className="size-4" aria-hidden />
          <span className="hidden sm:inline">More</span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {moreOpen && (
          <motion.div
            key="more"
            style={{ transformOrigin: "top" }}
            initial={{ opacity: 0, scaleY: 0.94 }}
            animate={{ opacity: 1, scaleY: 1, transition: SPRING.gentle }}
            exit={{ opacity: 0, transition: { duration: DURATION.fast, ease: EASE.in } }}
          >
            <EveExport agentId={agent.id} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-stone-300 py-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] text-stone-500">
            <Term id="schedule">Runs</Term>
          </span>
          <span className="text-[14px] text-stone-900">{agent.scheduleHuman}</span>
          <span className="font-mono text-[12px] tabular-nums text-stone-500" title={fullTime(agent.nextRunAt)}>
            {agent.status === "paused" ? "paused" : !agent.nextRunAt ? "not scheduled" : nextLabel(relTime(agent.nextRunAt))}
          </span>
        </div>
        <Stat label="Health" term="health" tone={healthTone}>
          <NumberTicker value={Math.round(agent.health)} />
          <span className="text-[13px] text-stone-500">/100</span>
        </Stat>
        <Stat label="Cost" term="cost">
          <NumberTicker value={agent.costUsd} format={usd} />
        </Stat>
        <Stat label="Jobs done" term="run">
          <NumberTicker value={agent.runs} />
        </Stat>
        <Stat label="Fixed itself" term="repair" tone={agent.repairs > 0 ? "text-violet-700" : undefined}>
          <span className="inline-flex items-center gap-1.5">
            {agent.repairs > 0 && <Wrench className="size-4" aria-hidden />}
            <NumberTicker value={agent.repairs} format={(n) => `${Math.round(n)}×`} />
          </span>
        </Stat>
      </div>
    </header>
  );
}
