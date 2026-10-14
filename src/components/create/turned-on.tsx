"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { AgentStatus } from "@/lib/types";
import { DISTANCE, DURATION, EASE, FadeIn, SPRING, StatusMorph } from "@/components/motion";

const BTN =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[4px] px-5 text-[15px] font-medium transition-[background-color,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60";

type Props = { agentId: string; where: string; when: string | null; celebrate: boolean };

/** After "Turn it on": the status morphs ready → live (emerald burst), one soft glow, then the next steps. */
export function TurnedOn({ agentId, where, when, celebrate }: Props) {
  const [status, setStatus] = useState<AgentStatus>(celebrate ? "ready" : "live");
  useEffect(() => {
    if (status === "live") return;
    const t = setTimeout(() => setStatus("live"), DURATION.normal * 1000);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <motion.section
      aria-labelledby="on-heading"
      className="relative overflow-hidden rounded-[6px] border border-emerald-300 bg-[#FBFAF7] p-5 sm:p-6"
      initial={celebrate ? { opacity: 0, y: DISTANCE.md, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.gentle}
    >
      {celebrate && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-[radial-gradient(circle,rgb(16_185_129/0.35),transparent_65%)]"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={{ duration: DURATION.crawl * 2, ease: EASE.out, delay: DURATION.normal }}
        />
      )}
      <div className="relative flex flex-col gap-4">
        <StatusMorph status={status} size="md" className="w-fit" />
        <div>
          <h3 id="on-heading" className="text-[22px] font-semibold tracking-[-0.02em] text-stone-900">
            Your agent is on
          </h3>
          <p className="mt-1 max-w-[56ch] text-[15px] text-stone-600">
            It will message {where} {when ?? "on its schedule"}. If a source changes and it breaks, it fixes itself and tells you what it changed.
          </p>
        </div>
        <FadeIn delay={celebrate ? DURATION.slow : 0} y={DISTANCE.sm} className="flex flex-wrap items-center gap-3">
          <Link href="/fleet" className={`${BTN} bg-stone-900 text-[#F6F4EF] hover:bg-violet-700`}>
            See it in My agents
          </Link>
          <Link href="/" className={`${BTN} border border-stone-900 bg-white text-stone-900 hover:bg-stone-100`}>
            Build another
          </Link>
          <Link
            href={`/agents/${agentId}`}
            className="rounded-[2px] text-[14px] font-medium text-violet-700 underline decoration-violet-300 underline-offset-[3px] hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60"
          >
            Open this agent
          </Link>
        </FadeIn>
      </div>
    </motion.section>
  );
}
