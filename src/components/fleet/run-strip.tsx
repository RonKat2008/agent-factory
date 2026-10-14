import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { classifyRuns, type BarTone } from "./run-history";

const TONE: Record<BarTone, string> = {
  ok: "bg-emerald-600",
  failed: "bg-red-600",
  repair: "bg-violet-600",
  held: "bg-stone-400",
};
const SLOTS = 20;
const MAX_H = 24;
const MIN_H = 4;

export function RunStrip({ recent }: { recent: Agent["recent"] }) {
  const runs = recent ?? [];
  const tones = classifyRuns(runs);
  const maxMs = Math.max(1, ...runs.map((r) => r.ms ?? 0));
  const count = (t: BarTone) => tones.filter((x) => x === t).length;
  const label = runs.length
    ? `Last ${runs.length} runs, oldest to newest: ${count("ok")} succeeded, ${count("failed")} failed, ${count("repair")} repair-related, ${count("held")} held. Bar height is duration.`
    : "No runs yet";

  return (
    <div role="img" aria-label={label} className="flex h-6 items-end gap-[2px]">
      {Array.from({ length: SLOTS }, (_, i) => {
        const idx = i - (SLOTS - runs.length);
        const r = idx >= 0 ? runs[idx] : null;
        if (!r) return <span key={i} className="h-[2px] w-[5px] rounded-[1px] bg-stone-300/70" aria-hidden />;
        const h = r.ms == null ? MIN_H : Math.max(MIN_H, Math.round((r.ms / maxMs) * MAX_H));
        return (
          <span
            key={i}
            aria-hidden
            style={{ height: h }}
            className={cn("w-[5px] rounded-t-[1px]", TONE[tones[idx]])}
            title={`${r.kind.replace("_", " ")} · ${r.status}${r.ms != null ? ` · ${(r.ms / 1000).toFixed(1)}s` : ""}`}
          />
        );
      })}
    </div>
  );
}
