"use client";

import { CornerDownLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Every weekday at 9am, send me the top 3 Hacker News posts about AI agents with links",
  "Watch the Vercel changelog and tell me in Slack when they ship something about AI",
  "Every hour, post new Next.js releases with the headline change",
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
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500">New agent / 01 describe</p>
      <h1 id="new-heading" className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
        What job should the factory take over?
      </h1>
      <p className="mt-2 text-[14px] text-stone-500">
        One sentence. The factory plans it, writes the tests, runs them, and fixes its own failures before it ever goes live.
      </p>

      <div className="mt-6 border border-stone-300 bg-[#FBFAF7] rounded-[3px] shadow-[0_1px_0_rgba(0,0,0,0.04)] focus-within:ring-2 focus-within:ring-stone-900/40">
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
          className="block w-full resize-none bg-transparent p-4 font-mono text-[15px] leading-relaxed text-stone-900 outline-none placeholder:text-stone-400 disabled:opacity-60"
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
            className="ml-auto inline-flex items-center gap-2 rounded-[3px] bg-stone-900 px-4 py-2 text-[13px] font-medium text-[#F6F4EF] hover:bg-stone-700 focus-visible:outline-none focus-visible:ring-2 ring-stone-900/40 disabled:cursor-not-allowed disabled:opacity-40"
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
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500">Or start from</p>
        <ul className="mt-2 flex flex-col gap-2">
          {EXAMPLES.map((ex, i) => (
            <li key={ex}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onChange(ex)}
                className={cn(
                  "group flex w-full items-baseline gap-3 rounded-[3px] border border-stone-300 bg-[#FBFAF7] px-3 py-2 text-left text-[13px] text-stone-700",
                  "hover:border-stone-900 hover:bg-white focus-visible:outline-none focus-visible:ring-2 ring-stone-900/40 disabled:opacity-50",
                )}
              >
                <span className="font-mono text-[11px] tabular-nums text-stone-400 group-hover:text-stone-900">0{i + 1}</span>
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
