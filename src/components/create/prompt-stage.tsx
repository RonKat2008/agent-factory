"use client";

import { CornerDownLeft, Hash, Loader2, Newspaper, Rocket, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLES: { icon: LucideIcon; title: string; hint: string; prompt: string }[] = [
  {
    icon: Newspaper,
    title: "Morning AI digest",
    hint: "Builds a weekday scraper that posts 3 linked headlines.",
    prompt: "Every weekday at 9am, send me the top 3 Hacker News posts about AI agents with links",
  },
  {
    icon: Rocket,
    title: "Changelog watcher",
    hint: "Builds a page monitor that pings Slack on AI news.",
    prompt: "Watch the Vercel changelog and tell me in Slack when they ship something about AI",
  },
  {
    icon: Hash,
    title: "Release announcer",
    hint: "Builds an hourly check that summarizes new releases.",
    prompt: "Every hour, post new Next.js releases with the headline change",
  },
];

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
};

export function PromptStage({ value, onChange, onSubmit, pending, error }: Props) {
  const canSubmit = value.trim().length > 5 && !pending;
  return (
    <section aria-labelledby="new-heading" className="mx-auto w-full max-w-3xl">
      <p className="t-label">New agent / 01 describe</p>
      <h1 id="new-heading" className="t-title mt-3 text-[clamp(32px,6vw,52px)]">
        What job should the factory take over?
      </h1>
      <p className="t-lede mt-3 max-w-[56ch]">
        Other tools help you build an agent. Ours takes responsibility for keeping it working. Describe the job in one sentence; the factory plans it, writes the tests, and fixes its own failures before it goes live.
      </p>

      <div className="mt-7 border border-stone-300 bg-[#FBFAF7] rounded-[3px] shadow-[0_1px_0_rgba(0,0,0,0.04),0_14px_30px_-18px_rgba(28,25,23,0.35)] transition-shadow focus-within:border-violet-600 focus-within:ring-2 focus-within:ring-violet-600/30">
        <label htmlFor="request" className="sr-only">
          Describe a recurring job
        </label>
        <textarea
          id="request"
          autoFocus
          rows={4}
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Describe a recurring job in one sentence…"
          className="block w-full resize-none bg-transparent p-4 font-mono text-[16px] leading-relaxed text-stone-900 outline-none placeholder:text-stone-400 disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-3 py-2">
          <span className="hidden items-center gap-1 font-mono text-[11px] text-stone-500 sm:flex">
            <kbd className="rounded-[2px] border border-stone-300 px-1">⌘</kbd>
            <kbd className="rounded-[2px] border border-stone-300 px-1">
              <CornerDownLeft className="inline size-3" aria-hidden />
            </kbd>
            to build
          </span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="ml-auto inline-flex items-center gap-2 rounded-[3px] bg-stone-900 px-4 py-2 text-[13px] font-medium text-[#F6F4EF] transition-[background-color,transform] hover:bg-stone-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {pending ? "Starting…" : "Build agent"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800 rounded-[3px]">
          {error}
        </p>
      )}

      <div className="mt-8">
        <p className="t-label">Or start from</p>
        <ul className="mt-2.5 grid gap-3 sm:grid-cols-3">
          {EXAMPLES.map(({ icon: Icon, title, hint, prompt }) => (
            <li key={title} className="flex">
              <button
                type="button"
                disabled={pending}
                onClick={() => onChange(prompt)}
                className={cn(
                  "group flex w-full flex-col gap-2 rounded-[3px] border border-stone-300 bg-[#FBFAF7] p-3.5 text-left",
                  "transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-stone-900 hover:shadow-[0_10px_24px_-14px_rgba(28,25,23,0.45)]",
                  "active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 disabled:opacity-50 disabled:hover:translate-y-0",
                )}
              >
                <span className="grid size-8 place-items-center rounded-[3px] border border-stone-300 bg-white text-stone-700 transition-colors group-hover:border-violet-600 group-hover:bg-violet-600 group-hover:text-white">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-[14px] font-semibold text-stone-900">{title}</span>
                <span className="text-[13px] leading-snug text-stone-600">{prompt}</span>
                <span className="mt-auto pt-1 font-mono text-[11px] leading-snug text-violet-700">{hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
