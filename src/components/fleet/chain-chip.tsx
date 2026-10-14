import Link from "next/link";
import type { Agent } from "@/lib/types";
import { FOCUS } from "@/components/ui-tokens";
import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex max-w-full items-center gap-1 rounded-[3px] border border-violet-300 bg-violet-50 px-2 py-0.5 text-[12px] text-violet-800 hover:bg-violet-100";

/** Violet chips showing which agents this one triggers, or what triggers it. */
export function ChainChip({ chains }: { chains?: Agent["chains"] }) {
  if (!chains || (!chains.triggeredBy && chains.triggers.length === 0)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chains.triggeredBy && (
        <Link href={`/agents/${chains.triggeredBy.id}`} className={cn(CHIP, FOCUS)}>
          <span aria-hidden>⚡</span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Runs when {chains.triggeredBy.name} posts</span>
        </Link>
      )}
      {chains.triggers.map((t) => (
        <Link key={t.id} href={`/agents/${t.id}`} className={cn(CHIP, FOCUS)}>
          <span aria-hidden>⚡</span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Triggers {t.name}</span>
        </Link>
      ))}
    </div>
  );
}
