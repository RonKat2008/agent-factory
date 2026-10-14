import type { Stats } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Stat({ label, value, accent, loading }: { label: string; value: string; accent?: boolean; loading: boolean }) {
  return (
    <div className={cn("px-4 py-3", accent && "bg-violet-50/60")}>
      <div className={cn("font-mono text-[11px] uppercase tracking-[0.12em]", accent ? "text-violet-700" : "text-stone-500")}>
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-1.5 h-9 w-20 rounded-[3px]" />
      ) : (
        <div
          className={cn(
            "mt-0.5 font-mono text-[34px] font-semibold leading-tight tabular-nums",
            accent ? "text-violet-700" : "text-stone-900",
          )}
        >
          {value}
        </div>
      )}
    </div>
  );
}

export function StatStrip({ stats }: { stats: Stats | null }) {
  const l = !stats;
  return (
    <section aria-label="Fleet totals">
      <div className="grid grid-cols-2 divide-stone-300 rounded-[3px] border border-stone-300 bg-[#FBFAF7] shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:grid-cols-4 sm:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-stone-300 sm:[&>*:nth-child(-n+2)]:border-b-0 [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-stone-300 sm:[&>*:nth-child(odd)]:border-r-0">
        <Stat loading={l} label="Agents live" value={String(stats?.agentsLive ?? 0)} />
        <Stat loading={l} label="Runs today" value={String(stats?.runsToday ?? 0)} />
        <Stat loading={l} label="Repaired automatically" value={String(stats?.autoRepairs ?? 0)} accent />
        <Stat loading={l} label="Total cost" value={`$${(stats?.totalCostUsd ?? 0).toFixed(4)}`} />
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Other tools help you build an agent. Ours takes responsibility for keeping it working.
      </p>
    </section>
  );
}
