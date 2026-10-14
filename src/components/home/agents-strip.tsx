"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAgents } from "@/lib/api-client";
import { FadeIn, NumberTicker } from "@/components/motion";

/** A quiet line under the home input for returning users: "You have 3 agents working → My agents". */
export function AgentsStrip() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    getAgents()
      .then((list) => {
        if (alive) setCount(list.filter((a) => a.status !== "building" && a.status !== "testing").length);
      })
      .catch(() => {
        /* optional hint: stay hidden */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!count) return null;
  return (
    <FadeIn y={0} className="mt-4">
      <Link
        href="/fleet"
        className="group inline-flex items-center gap-2 rounded-[3px] text-[14px] text-stone-600 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60"
      >
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
        You have <NumberTicker value={count} from={0} className="font-mono tabular-nums text-stone-900" /> {count === 1 ? "agent" : "agents"} working
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        <span className="font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 group-hover:decoration-stone-900">My agents</span>
      </Link>
    </FadeIn>
  );
}
