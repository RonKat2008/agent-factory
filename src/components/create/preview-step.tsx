import { Check, Wrench, X } from "lucide-react";
import type { AgentSpec, FeedEvent, Run } from "@/lib/types";
import { SlackPreview } from "./slack-preview";
import { fixLine, testLabel } from "./plain";
import { cn } from "@/lib/utils";

type Props = { name: string; spec: AgentSpec | null; run: Run | null; events: FeedEvent[]; channel: string; time: string };

export function PreviewStep({ name, spec, run, events, channel, time }: Props) {
  const message = run?.output?.message?.trim() ?? "";
  const fixes = events.filter((e) => e.type === "self_fixed");
  const results = new Map((run?.tests ?? []).map((t) => [t.testIndex, t.passed]));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section aria-labelledby="preview-heading" className="min-w-0">
        <h3 id="preview-heading" className="text-[15px] font-semibold text-stone-900">
          This is the message you’ll get
        </h3>
        <p className="mt-0.5 text-[13px] text-stone-500">From a real test run just now, using today’s data.</p>
        <div className="mt-3">
          {message ? (
            <SlackPreview name={name} text={message} channel={channel} time={time} />
          ) : (
            <p className="rounded-[6px] border border-dashed border-stone-300 bg-white px-4 py-6 text-[14px] text-stone-600">
              Nothing to send this time. The agent stays quiet when there’s nothing new, and it will message you as soon as something changes.
            </p>
          )}
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-5">
        {spec && (
          <section aria-labelledby="checks-heading">
            <h3 id="checks-heading" className="text-[15px] font-semibold text-stone-900">
              Checked before every message
            </h3>
            <ul className="mt-2 space-y-1.5">
              {spec.tests.map((t, i) => {
                const passed = results.get(i);
                return (
                  <li key={`${t.kind}-${i}`} className="flex items-start gap-2 text-[14px] text-stone-800">
                    <span
                      className={cn(
                        "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full",
                        passed === false ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700",
                      )}
                    >
                      {passed === false ? <X className="size-3" aria-label="Failed" /> : <Check className="size-3" aria-label="Passed" />}
                    </span>
                    <span className="min-w-0 break-words">{testLabel(t)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {fixes.length > 0 && (
          <section aria-labelledby="fixes-heading">
            <h3 id="fixes-heading" className="text-[15px] font-semibold text-stone-900">
              Problems it found and fixed while testing
            </h3>
            <ul className="mt-2 space-y-1.5">
              {fixes.map((e) => (
                <li key={e.id} className="flex items-start gap-2 text-[14px] text-violet-900">
                  <Wrench className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden />
                  <span className="min-w-0 break-words">{fixLine(e.message)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
