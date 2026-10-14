"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { AgentSpec, FeedEvent, Run } from "@/lib/types";
import { Term } from "@/components/explain";
import { DISTANCE, DURATION, EASE, SPRING, STAGGER, Stagger, StaggerItem } from "@/components/motion";
import { cn } from "@/lib/utils";
import { SlackPreview } from "./slack-preview";
import { AnimatedCheck, AnimatedCross } from "./animated-check";
import { pairFixes } from "./build-checklist";
import { failLine, fixLine, testLabel } from "./plain";

type Props = { name: string; spec: AgentSpec | null; run: Run | null; events: FeedEvent[]; channel: string; time: string };

/** How long the "A check failed" state shows before it turns into "Fixed: …". */
const FIX_REPLAY_MS = 1100;

/** Replays the build's repair as a morph: red "A check failed" → violet "Fixed: … and re-tested ✓". */
function FixMorph({ failed, fixed, delayMs }: { failed: string; fixed: string; delayMs: number }) {
  const reduce = useReducedMotion();
  const [isFixed, setIsFixed] = useState(Boolean(reduce));
  useEffect(() => {
    if (isFixed) return;
    const t = setTimeout(() => setIsFixed(true), delayMs);
    return () => clearTimeout(t);
  }, [isFixed, delayMs]);
  return (
    <li className="relative flex items-start gap-2.5 overflow-hidden rounded-[4px] px-2.5 py-2">
      <motion.span aria-hidden className="absolute inset-0 bg-red-50" initial={false} animate={{ opacity: isFixed ? 0 : 1 }} transition={{ duration: DURATION.normal }} />
      <motion.span aria-hidden className="absolute inset-0 bg-violet-50" initial={false} animate={{ opacity: isFixed ? 1 : 0 }} transition={{ duration: DURATION.normal }} />
      <span className="relative mt-px">{isFixed ? <AnimatedCheck key="ok" tone="violet" label="Fixed" /> : <AnimatedCross key="x" />}</span>
      <span className="relative min-w-0 flex-1 text-[14px] leading-snug" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isFixed ? "fixed" : "failed"}
            className={cn("block break-words", isFixed ? "font-medium text-violet-900" : "text-red-800")}
            initial={{ opacity: 0, y: DISTANCE.xs }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -DISTANCE.xs, transition: { duration: DURATION.fast } }}
            transition={{ duration: DURATION.normal, ease: EASE.out }}
          >
            {isFixed ? fixed : `A check failed${failed ? `: ${failed}` : ""}`}
          </motion.span>
        </AnimatePresence>
      </span>
    </li>
  );
}

export function PreviewStep({ name, spec, run, events, channel, time }: Props) {
  const message = run?.output?.message?.trim() ?? "";
  const repairs = pairFixes(events).filter((p) => p.fixed !== null);
  const results = new Map((run?.tests ?? []).map((t) => [t.testIndex, t.passed]));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section aria-labelledby="preview-heading" className="min-w-0">
        <h3 id="preview-heading" className="text-[15px] font-semibold text-stone-900">
          This is the message you’ll get
        </h3>
        <p className="mt-0.5 text-[13px] text-stone-500">
          From a real <Term id="dry-run">test run</Term> just now, using today’s data.
        </p>
        <motion.div className="mt-3" initial={{ opacity: 0, y: DISTANCE.lg * 2 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.gentle, delay: DURATION.fast }}>
          {message ? (
            <SlackPreview name={name} text={message} channel={channel} time={time} />
          ) : (
            <p className="rounded-[6px] border border-dashed border-stone-300 bg-white px-4 py-6 text-[14px] text-stone-600">
              Nothing to send this time. The agent stays quiet when there’s nothing new, and it will message you as soon as something changes.
            </p>
          )}
        </motion.div>
      </section>

      <div className="flex min-w-0 flex-col gap-5">
        {spec && (
          <section aria-labelledby="checks-heading">
            <h3 id="checks-heading" className="text-[15px] font-semibold text-stone-900">
              <Term id="tests">Checked</Term> before every message
            </h3>
            <Stagger as="ul" gap="normal" delay={DURATION.normal} className="mt-2 space-y-1.5">
              {spec.tests.map((t, i) => {
                const passed = results.get(i);
                return (
                  <StaggerItem as="li" key={`${t.kind}-${i}`} className="flex items-start gap-2 text-[14px] text-stone-800">
                    {passed === false ? (
                      <AnimatedCross delay={DURATION.normal + i * STAGGER.normal} className="mt-px size-[18px]" />
                    ) : (
                      <AnimatedCheck tone="emerald" delay={DURATION.normal + i * STAGGER.normal} className="mt-px size-[18px]" label="Passed" />
                    )}
                    <span className="min-w-0 break-words">{testLabel(t)}</span>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </section>
        )}
        {repairs.length > 0 && (
          <section aria-labelledby="fixes-heading">
            <h3 id="fixes-heading" className="text-[15px] font-semibold text-stone-900">
              Problems it found and <Term id="repair">fixed</Term> while testing
            </h3>
            <ul className="mt-2 space-y-1.5">
              {repairs.map(({ failed, fixed }, i) => (
                <FixMorph key={failed.id} failed={failed.type === "test_failed" ? failLine(failed.message) : ""} fixed={fixLine(fixed?.message ?? "")} delayMs={FIX_REPLAY_MS + i * FIX_REPLAY_MS} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
