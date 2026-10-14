"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Bell, CloudSun, CornerDownLeft, Loader2, Newspaper, PackageCheck, type LucideIcon } from "lucide-react";
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
const TITLE = "What should your agent do?";

type Props = { initial?: string; showTourCallout?: boolean; belowInput?: ReactNode };

export function HomeBuilder({ initial = "", showTourCallout = false, belowInput }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [going, setGoing] = useState<string | null>(null);
  const [filled, setFilled] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        className="text-[clamp(34px,6.4vw,62px)] font-semibold leading-[1.04] tracking-[-0.03em] text-stone-900"
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
        <Pulse trigger={filled} tone="violet" radius={6} className="flex w-full">
          <form
            data-tour="home-input"
            className="group/input relative w-full rounded-[6px] border-2 border-stone-900 bg-white shadow-[6px_6px_0_0_#1c1917] transition-[box-shadow,border-color] duration-300 focus-within:border-violet-700 focus-within:shadow-[6px_6px_0_0_#6d28d9]"
            onSubmit={(e) => {
              e.preventDefault();
              start(value);
            }}
          >
            {/* Soft focus glow: a blurred violet halo that fades in (opacity only) while the box has focus. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-3 -z-10 rounded-[14px] bg-violet-500/25 opacity-0 blur-xl transition-opacity duration-500 group-focus-within/input:opacity-100"
            />
            <label htmlFor="home-request" className="sr-only">
              {TITLE}
            </label>
            <textarea
              ref={inputRef}
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
              placeholder="Every weekday at 9, tell #product what our competitors shipped…"
              className="block min-h-[96px] w-full resize-none rounded-[6px] bg-transparent px-5 pt-4 pb-2 text-[18px] leading-snug text-stone-900 outline-none transition-opacity duration-300 placeholder:text-stone-400 disabled:opacity-60 sm:text-[21px]"
            />
            <div className="flex items-center justify-between gap-3 px-3 pb-3">
              <span className="hidden items-center gap-1.5 pl-2 text-[13px] text-stone-500 sm:flex">
                <CornerDownLeft className="size-3.5" aria-hidden /> Enter to build
              </span>
              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileTap={canSubmit ? { scale: 0.97 } : undefined}
                transition={SPRING.snappy}
                className="ml-auto inline-flex h-11 items-center gap-2 rounded-[4px] bg-stone-900 px-5 text-[15px] font-medium text-[#F6F4EF] transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {going ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {going ? "Planning…" : "Build my agent"}
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
              <StaggerItem as="li" key={text} className="flex">
                <motion.button
                  type="button"
                  disabled={Boolean(going)}
                  onClick={() => fill(text)}
                  aria-pressed={chosen}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING.snappy}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-[4px] border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow]",
                    "hover:shadow-[0_10px_24px_-14px_rgba(28,25,23,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 disabled:opacity-50",
                    chosen ? "border-violet-600 bg-violet-50/60" : "border-stone-300 bg-[#FBFAF7] hover:border-stone-900 hover:bg-white",
                  )}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-[4px] transition-colors", chosen ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-800 group-hover:bg-violet-600 group-hover:text-white")}>
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
