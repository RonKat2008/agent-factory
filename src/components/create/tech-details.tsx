import type { AgentSpec, FeedEvent, Run } from "@/lib/types";
import { BuildLog } from "./build-log";

type Props = { events: FeedEvent[]; active: boolean; spec: AgentSpec | null; run: Run | null };

/** Everything an engineer wants and a normal person doesn't: build log, tests, spec JSON. */
export function TechDetails({ events, active, spec, run }: Props) {
  return (
    <details className="group rounded-[4px] border border-stone-300 bg-[#FBFAF7]">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-[13px] font-medium text-stone-600 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/50">
        <span className="group-open:hidden">Show technical details</span>
        <span className="hidden group-open:inline">Hide technical details</span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-stone-200 p-4">
        <BuildLog events={events} active={active} />
        {spec && (
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500">Tests ({spec.tests.length})</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {spec.tests.map((t, i) => {
                const result = run?.tests?.find((r) => r.testIndex === i);
                return (
                  <li
                    key={`${t.kind}-${i}`}
                    title={result?.detail ?? t.note ?? undefined}
                    className="rounded-[2px] border border-stone-300 px-1.5 py-0.5 font-mono text-[11px] text-stone-700"
                  >
                    {result ? (result.passed ? "✓ " : "✗ ") : ""}
                    {t.kind}
                    {t.addedBy === "repair" ? " (repair)" : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {spec && (
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500">Spec · cron {spec.schedule} (UTC)</p>
            <pre className="mt-1.5 max-h-80 overflow-auto rounded-[3px] bg-stone-950 p-3 font-mono text-[12px] leading-relaxed text-stone-200">
              {JSON.stringify(spec, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}
