import { relTime, fullTime } from "@/components/time";
import type { Agent } from "@/lib/types";
import { previewSegments } from "./run-history";

export function LastOutput({ output, now }: { output: Agent["lastOutput"]; now: number }) {
  if (!output) {
    return <p className="truncate text-[13px] text-stone-400">Nothing posted yet</p>;
  }
  const segs = previewSegments(output.message);
  return (
    <p className="flex min-w-0 items-baseline gap-2 text-[13px] text-stone-700">
      <span className="min-w-0 truncate">
        {segs.map((s, i) =>
          s.href ? (
            <a
              key={i}
              href={s.href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-stone-900 underline decoration-stone-400 underline-offset-2 hover:decoration-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
            >
              {s.text}
            </a>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </span>
      <time dateTime={output.at} title={fullTime(output.at)} className="shrink-0 font-mono text-[11px] tabular-nums text-stone-500">
        {relTime(output.at, now)}
      </time>
    </p>
  );
}
