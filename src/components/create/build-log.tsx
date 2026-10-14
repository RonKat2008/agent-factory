import type { FeedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour12: false });

function Line({ e, struck }: { e: FeedEvent; struck: boolean }) {
  let tone = "text-stone-300";
  let prefix = "▸";
  let text = e.message;
  if (e.type === "test_failed") {
    tone = "text-red-400";
    prefix = "✗";
  } else if (e.type === "self_fixed") {
    tone = "text-violet-300";
    prefix = "▸";
    text = `↻ self-fixed: ${e.message}`;
  } else if (e.type === "tests_passed") {
    tone = "text-emerald-400";
    prefix = "✓";
  } else if (e.type === "needs_human") {
    tone = "text-red-400";
    prefix = "✗";
  }
  return (
    <li
      className={cn(
        "flex gap-3 py-0.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-300",
        tone,
      )}
    >
      <time dateTime={e.createdAt} title={e.createdAt} className="shrink-0 tabular-nums text-stone-500">
        {fmtTime(e.createdAt)}
      </time>
      <span className="shrink-0" aria-hidden>
        {prefix}
      </span>
      <span className={cn("min-w-0 break-words transition-opacity duration-500", struck && "line-through decoration-red-400/70 opacity-50")}>
        {text}
        {struck && <span className="sr-only"> (fixed)</span>}
      </span>
    </li>
  );
}

export function BuildLog({ events, active }: { events: FeedEvent[]; active: boolean }) {
  const lastFix = events.map((e) => e.type).lastIndexOf("self_fixed");
  return (
    <section aria-label="Build log" className="overflow-hidden rounded-[3px] border border-stone-800 bg-stone-950 shadow-[0_18px_40px_-20px_rgba(28,25,23,0.6)]">
      <header className="flex items-center justify-between border-b border-stone-800 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500">
        <span className="flex items-center gap-2"><span className="flex gap-1" aria-hidden><i className="size-2 rounded-full bg-stone-700" /><i className="size-2 rounded-full bg-stone-700" /><i className="size-2 rounded-full bg-stone-700" /></span>factory.log</span>
        <span className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", active ? "bg-sky-400 motion-safe:animate-pulse" : "bg-stone-600")} aria-hidden />
          {active ? "running" : "idle"}
        </span>
      </header>
      <ol
        aria-live="polite"
        className="min-h-48 px-4 py-3 font-mono text-[13px] leading-relaxed text-stone-100"
      >
        {events.length === 0 && !active && <li className="text-stone-500">no events yet</li>}
        {events.map((e, i) => (
          <Line key={e.id} e={e} struck={e.type === "test_failed" && i < lastFix} />
        ))}
        {active && (
          <li className="flex gap-3 py-0.5 text-stone-500" aria-hidden>
            <span className="tabular-nums">{events.length ? "        " : "--:--:--"}</span>
            <span>▸</span>
            <span className="inline-block h-[1.1em] w-2 translate-y-0.5 bg-stone-300 motion-safe:animate-pulse" />
          </li>
        )}
      </ol>
    </section>
  );
}
