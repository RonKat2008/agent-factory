"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, CloudSun, Loader2, Newspaper, PackageCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLES: { icon: LucideIcon; text: string }[] = [
  { icon: Newspaper, text: "Every morning at 9, send me the top 3 AI news stories in Slack" },
  { icon: Bell, text: "Tell me in Slack when a competitor's changelog changes" },
  { icon: PackageCheck, text: "Every Friday, summarize new Next.js releases and flag breaking changes" },
  { icon: CloudSun, text: "Every morning, post the weather in San Francisco to Slack" },
];

const MIN_CHARS = 8;

export function HomeBuilder({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [going, setGoing] = useState<string | null>(null);

  const start = (text: string) => {
    const request = text.trim();
    if (request.length < MIN_CHARS || going) return;
    setGoing(request);
    router.push(`/new?request=${encodeURIComponent(request)}`);
  };

  const canSubmit = value.trim().length >= MIN_CHARS && !going;

  return (
    <section aria-labelledby="home-heading" className="max-w-3xl">
      <h1 id="home-heading" className="text-[clamp(36px,6.4vw,64px)] font-semibold leading-[1.02] tracking-[-0.025em] text-stone-900">
        What should your agent do?
      </h1>
      <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-stone-600">
        Describe a job in one sentence. We build it, test it on real data, show you the exact message you’ll get, and keep it working every day.
      </p>

      <form
        className="mt-8 rounded-[6px] border-2 border-stone-900 bg-white shadow-[6px_6px_0_0_#1c1917] transition-shadow focus-within:shadow-[6px_6px_0_0_#7c3aed]"
        onSubmit={(e) => {
          e.preventDefault();
          start(value);
        }}
      >
        <label htmlFor="home-request" className="sr-only">
          What should your agent do?
        </label>
        <textarea
          id="home-request"
          rows={2}
          value={value}
          disabled={Boolean(going)}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              start(value);
            }
          }}
          placeholder="Every morning at 8, send me…"
          className="block w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[20px] leading-snug text-stone-900 outline-none placeholder:text-stone-400 disabled:opacity-60 sm:text-[22px]"
        />
        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <span className="hidden pl-2 text-[13px] text-stone-500 sm:block">Press Enter to build it</span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="ml-auto inline-flex h-11 items-center gap-2 rounded-[4px] bg-stone-900 px-5 text-[15px] font-medium text-[#F6F4EF] transition-[background-color,transform] hover:bg-violet-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {going === value.trim() && going ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Build my agent
          </button>
        </div>
      </form>

      <div className="mt-8">
        <h2 className="text-[14px] font-medium text-stone-700">Or start with one of these</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {EXAMPLES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex">
              <button
                type="button"
                disabled={Boolean(going)}
                onClick={() => start(text)}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-[4px] border border-stone-300 bg-[#FBFAF7] px-3.5 py-3 text-left",
                  "transition-[border-color,background-color,transform] hover:border-stone-900 hover:bg-white active:scale-[0.99]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 disabled:opacity-50",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden />
                <span className="flex-1 text-[15px] leading-snug text-stone-900">{text}</span>
                {going === text ? (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-stone-500" aria-label="Starting" />
                ) : (
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-stone-900" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
