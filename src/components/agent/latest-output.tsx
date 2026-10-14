import { ExternalLink } from "lucide-react";
import { SlackMessage } from "@/components/slack-message";
import type { Run } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PANEL, fullTime, relTime } from "./format";

/** What the agent actually produces: the last succeeded run's message, styled like a Slack post. */
export function LatestOutput({ runs, agentName }: { runs: Run[]; agentName: string }) {
  const run = runs.find((r) => r.status === "succeeded" && r.output);
  const out = run?.output;
  const when = run ? (run.finishedAt ?? run.startedAt) : null;
  return (
    <section className={cn(PANEL, "border-stone-400 p-5")} aria-label="Latest message">
      <h2 className="mb-1 text-[16px] font-semibold tracking-tight text-stone-900">What it sent last</h2>
      <p className="mb-4 text-[13px] text-stone-500">Exactly what landed in Slack.</p>
      {!run || !out ? (
        <p className="rounded-[4px] border border-dashed border-stone-300 px-3 py-4 text-[14px] text-stone-500">Nothing sent yet. Hit &ldquo;Run now&rdquo; to see its first message here.</p>
      ) : (
        <div className="flex gap-3 rounded-[4px] border border-stone-200 bg-white p-3.5">
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[4px] bg-stone-900 font-mono text-[13px] text-[#F6F4EF]"
            aria-hidden
          >
            {agentName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-stone-900">
              {agentName}{" "}
              <span className="ml-1 rounded-[2px] bg-stone-200 px-1 font-mono text-[9px] font-normal uppercase text-stone-600">
                app
              </span>
            </p>
            <SlackMessage text={out.message} />
            {out.citations.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {out.citations.map((c, i) => (
                  <li key={i} className="min-w-0">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[260px] items-center gap-1 rounded-full border border-stone-300 bg-white px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
                    >
                      <ExternalLink className="size-3 shrink-0" aria-hidden />
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{c.text}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 font-mono text-[11px] tabular-nums text-stone-500">
              <span title={fullTime(when)}>
                {out.posted ? "Posted" : "Drafted, not posted"} {relTime(when)}
              </span>
              {" · run "}
              {run.id.slice(0, 6)}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
