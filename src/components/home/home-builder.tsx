"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Bell, CloudSun, CornerDownLeft, Loader2, Newspaper, PackageCheck, type LucideIcon } from "lucide-react";
import { FadeIn, Pulse, SPRING, Stagger, StaggerItem } from "@/components/motion";
import { cn } from "@/lib/utils";
import { HeroHeadline } from "./hero-headline";

const EXAMPLES: { icon: LucideIcon; label: string; text: string }[] = [
  { icon: Newspaper, label: "AI news digest", text: "Every morning at 9, send me the top 3 AI news stories in Slack" },
  { icon: Bell, label: "Competitor watch", text: "Tell me in Slack when a competitor's changelog changes" },
  { icon: PackageCheck, label: "Release notes", text: "Every Friday, summarize new Next.js releases and flag breaking changes" },
  { icon: CloudSun, label: "Morning weather", text: "Every morning, post the weather in San Francisco to Slack" },
];

const MIN_CHARS = 8;
const MIN_ROWS = 2;
const MAX_ROWS = 6;
const LINE_PX = 26;
const PAD_Y_PX = 28;
const TITLE = "What should your agent do?";

type Props = { initial?: string; showTourCallout?: boolean; belowInput?: ReactNode };

export function HomeBuilder({ initial = "", showTourCallout = false, belowInput }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [going, setGoing] = useState<string | null>(null);
  const [filled, setFilled] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reduce = useReducedMotion();

  // Auto-grow the textarea between MIN_ROWS and MAX_ROWS as the request gets longer.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const min = MIN_ROWS * LINE_PX + PAD_Y_PX;
    const max = MAX_ROWS * LINE_PX + PAD_Y_PX;
    el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight))}px`;
  }, [value]);

  const start = (text: string) => {
    const request = text.trim();
    if (request.length < MIN_CHARS || going) return;
    setGoing(request);
    router.push(`/new?request=${encodeURIComponent(request)}`);
  };

  const fill = (text: string) => {
    if (going) return;
    setValue(text);
    setFilled((n) => n + 1);
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(text.length, text.length);
  };

  const canSubmit = value.trim().length >= MIN_CHARS && !going;

  return (
    <section aria-labelledby="home-heading" className="min-w-0 max-w-3xl">
      <HeroHeadline
        id="home-heading"
        text={TITLE}
        className="text-balance text-[clamp(34px,5.6vw,58px)] font-semibold leading-[1.04] tracking-[-0.03em] text-stone-900"
      />
      <FadeIn delay={0.35}>
        <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-stone-600">
          Describe a recurring job in one sentence. Pitcrew builds it, tests it, runs it — and pits it back into shape when it breaks.
        </p>
        {showTourCallout && (
          <Link
            href="/tour"
            className="group mt-4 inline-flex items-center gap-2 rounded-full border border-violet-300 bg-violet-50 py-1.5 pl-2.5 pr-3.5 text-[14px] text-violet-900 transition-colors hover:border-violet-400 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60"
          >
            <span className="relative grid size-2 place-items-center" aria-hidden>
              <span className="absolute inset-0 rounded-full bg-violet-500/50 motion-safe:animate-ping" />
              <span className="relative size-2 rounded-full bg-violet-600" />
            </span>
            <strong className="font-semibold">Judges: take the 3-minute formation lap</strong> <span aria-hidden>→</span>
          </Link>
        )}
      </FadeIn>

      <FadeIn delay={0.5} className="mt-8">
        <Pulse trigger={filled} tone="violet" radius={14} className="flex w-full">
          <form
            data-tour="home-input"
            className="relative w-full rounded-[14px] border-[1.5px] border-stone-300 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_12px_32px_-18px_rgba(28,25,23,0.28)] transition-[box-shadow,border-color] duration-200 focus-within:border-violet-600 focus-within:shadow-[0_0_0_4px_rgba(124,58,237,0.12),0_8px_30px_-12px_rgba(124,58,237,0.35)]"
            onSubmit={(e) => {
              e.preventDefault();
              start(value);
            }}
          >
            <label htmlFor="home-request" className="sr-only">
              {TITLE}
            </label>
            <textarea
              ref={inputRef}
              id="home-request"
              rows={MIN_ROWS}
              value={value}
              disabled={Boolean(going)}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  start(value);
                }
              }}
              placeholder="Every weekday at 9, tell #product what our competitors shipped…"
              style={{ outline: "none", boxShadow: "none" }}
              className="block w-full resize-none overflow-y-auto rounded-t-[14px] border-0 bg-transparent px-5 pt-4 pb-3 text-[17px] leading-[26px] text-stone-900 shadow-none outline-none ring-0 transition-opacity duration-300 placeholder:text-stone-400 focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60"
            />
            <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-5 py-3">
              <span className="hidden items-center gap-1.5 text-[13px] text-stone-500 sm:flex">
                <CornerDownLeft className="size-3.5" aria-hidden /> Enter to build
              </span>
              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileHover={canSubmit && !reduce ? { y: -1 } : undefined}
                whileTap={canSubmit && !reduce ? { scale: 0.97 } : undefined}
                transition={SPRING.snappy}
                className="group/btn ml-auto inline-flex h-10 items-center gap-2 rounded-[10px] bg-stone-900 px-4 text-[15px] font-medium text-[#F6F4EF] shadow-[0_1px_2px_rgba(28,25,23,0.2)] transition-[background-color,box-shadow,opacity] enabled:hover:bg-stone-800 enabled:hover:shadow-[0_6px_16px_-6px_rgba(28,25,23,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {going ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {going ? "Planning…" : "Build my agent"}
                {going ? null : (
                  <ArrowRight className="size-4 opacity-80 transition-transform duration-200 group-hover/btn:translate-x-0.5" aria-hidden />
                )}
              </motion.button>
            </div>
          </form>
        </Pulse>
      </FadeIn>
      {belowInput}

      <div className="mt-9">
        <h2 className="text-[14px] font-medium text-stone-700">Or start from an example</h2>
        <Stagger as="ul" gap="normal" delay={0.65} className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {EXAMPLES.map(({ icon: Icon, label, text }) => {
            const chosen = value === text;
            return (
              <StaggerItem as="li" key={text} className="flex h-full">
                <motion.button
                  type="button"
                  disabled={Boolean(going)}
                  onClick={() => fill(text)}
                  aria-pressed={chosen}
                  whileHover={reduce ? undefined : { y: -2 }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  transition={SPRING.snappy}
                  className={cn(
                    "group flex h-full min-h-[84px] w-full items-start gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow]",
                    "hover:shadow-[0_10px_24px_-16px_rgba(124,58,237,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 disabled:opacity-50",
                    chosen ? "border-violet-600 bg-violet-50/60" : "border-stone-200 bg-[#FBFAF7] hover:border-violet-300 hover:bg-white",
                  )}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-[8px] ring-1 ring-inset transition-colors", chosen ? "bg-violet-600 text-white ring-violet-600" : "bg-violet-50 text-violet-700 ring-violet-200/70 group-hover:bg-violet-100")}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-stone-900">{label}</span>
                    <span className="mt-0.5 block text-[13.5px] leading-snug text-stone-600">{text}</span>
                  </span>
                </motion.button>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
