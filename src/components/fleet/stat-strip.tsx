import type { Stats } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

const int = (n: number) => String(Math.round(n));
const usd = (n: number) => `$${n.toFixed(4)}`;

function Stat({ label, value, format, accent, loading }: { label: string; value: number; format: (n: number) => string; accent?: boolean; loading: boolean }) {
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
          <CountUp value={value} format={format} />
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
        <Stat loading={l} label="Agents live" value={stats?.agentsLive ?? 0} format={int} />
        <Stat loading={l} label="Runs today" value={stats?.runsToday ?? 0} format={int} />
        <Stat loading={l} label="Repaired automatically" value={stats?.autoRepairs ?? 0} format={int} accent />
        <Stat loading={l} label="Total cost" value={stats?.totalCostUsd ?? 0} format={usd} />
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Other tools help you build an agent. Ours takes responsibility for keeping it working.
      </p>
    </section>
  );
}
