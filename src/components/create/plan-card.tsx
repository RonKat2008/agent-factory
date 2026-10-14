import { ArrowRight } from "lucide-react";
import type { AgentSpec, PlanCard as Plan } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROWS: [string, keyof Plan][] = [
  ["Runs", "runs"],
  ["Checks", "checks"],
  ["Does", "does"],
  ["Sends to", "sendsTo"],
  ["Asks before", "asksBefore"],
];

const LABEL = "font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500";

export function PlanCard({ plan, spec }: { plan: Plan | null; spec: AgentSpec | null }) {
  return (
    <section aria-label="Plan" className="border border-stone-300 bg-[#FBFAF7] rounded-[3px] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-2">
        <h2 className={LABEL}>Plan</h2>
        {spec && <span className="font-mono text-[11px] text-stone-500">{spec.schedule}</span>}
      </header>

      {plan ? (
        <dl className="divide-y divide-stone-200 motion-safe:animate-in motion-safe:fade-in duration-500">
          {ROWS.map(([label, key]) => (
            <div key={key} className="grid grid-cols-[96px_1fr] gap-3 px-4 py-2.5 sm:grid-cols-[120px_1fr]">
              <dt className={cn(LABEL, "pt-0.5")}>{label}</dt>
              <dd className="text-[14px] text-stone-900">{plan[key]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="space-y-3 px-4 py-4" aria-busy="true" aria-label="Planning">
          {ROWS.map(([label]) => (
            <div key={label} className="grid grid-cols-[96px_1fr] items-center gap-3 sm:grid-cols-[120px_1fr]">
              <span className={cn(LABEL, "opacity-60")}>{label}</span>
              <Skeleton className="h-4 w-3/4 rounded-[2px]" />
            </div>
          ))}
        </div>
      )}

      {spec && (
        <div className="space-y-3 border-t border-stone-200 px-4 py-3">
          <div>
            <p className={LABEL}>Pipeline</p>
            <ol className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {spec.steps.map((s, i) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  {i > 0 && <ArrowRight className="size-3 text-stone-400" aria-hidden />}
                  <span className="rounded-[2px] border border-stone-400 bg-white px-2 py-0.5 font-mono text-[12px] text-stone-900">
                    {s.block}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className={LABEL}>Tests</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {spec.tests.map((t, i) => (
                <li
                  key={`${t.kind}-${i}`}
                  className={cn(
                    "rounded-[2px] border px-1.5 py-0.5 font-mono text-[11px]",
                    t.addedBy === "repair"
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-stone-300 text-stone-600",
                  )}
                >
                  {t.kind}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
