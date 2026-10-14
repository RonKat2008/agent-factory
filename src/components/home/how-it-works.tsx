"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Transition } from "motion/react";
import { Wrench } from "lucide-react";
import { Term } from "@/components/explain";
import { DURATION, EASE, SPRING, Stagger, StaggerItem } from "@/components/motion";

// Mini illustrations: 56×56 line drawings in stone with violet/emerald accents. They draw once
// when they come into view and replay when the card is hovered (the svg is re-keyed).

const STROKE = "#44403c"; // stone-700
const VIOLET = "#7c3aed";
const EMERALD = "#059669";

type Draw = (delay: number, dur?: number) => {
  initial: false | { pathLength: number; opacity: number };
  whileInView: { pathLength: number; opacity: number };
  viewport: { once: boolean };
  transition: Transition;
};

function useDraw(): Draw {
  const reduce = useReducedMotion();
  return (delay, dur = DURATION.slow) => ({
    initial: reduce ? false : { pathLength: 0, opacity: 0 },
    whileInView: { pathLength: 1, opacity: 1 },
    viewport: { once: true },
    transition: { pathLength: { duration: dur, ease: EASE.out, delay }, opacity: { duration: DURATION.instant, delay } },
  });
}

function DescribeArt() {
  const draw = useDraw();
  return (
    <svg viewBox="0 0 56 56" className="size-14" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path d="M9 12h38a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H24l-9 8v-8H9a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3z" stroke={STROKE} strokeWidth="2" {...draw(0, DURATION.crawl)} />
      <motion.path d="M14 21h26" stroke={STROKE} strokeWidth="2" {...draw(0.55)} />
      <motion.path d="M14 28h18" stroke={VIOLET} strokeWidth="2.5" {...draw(0.85)} />
      <motion.rect x="35" y="25" width="2" height="6" rx="1" fill={VIOLET} initial={{ opacity: 0 }} whileInView={{ opacity: [0, 1, 0, 1, 0, 1] }} viewport={{ once: true }} transition={{ duration: DURATION.crawl * 1.6, delay: 1.2 }} />
    </svg>
  );
}

function BuildArt() {
  const draw = useDraw();
  const rows = [16, 27, 38];
  return (
    <svg viewBox="0 0 56 56" className="size-14" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.rect x="10" y="7" width="36" height="44" rx="3" stroke={STROKE} strokeWidth="2" {...draw(0, DURATION.crawl)} />
      <motion.path d="M22 5h12v5H22z" stroke={STROKE} strokeWidth="2" {...draw(0.2)} />
      {rows.map((y, i) => (
        <g key={y}>
          <motion.path d={`M27 ${y + 2}h12`} stroke={STROKE} strokeWidth="2" {...draw(0.4 + i * 0.25, DURATION.normal)} />
          <motion.path d={`M16 ${y + 2}l2.5 2.5L23 ${y - 2}`} stroke={i === 1 ? VIOLET : EMERALD} strokeWidth="2.5" {...draw(0.75 + i * 0.3, DURATION.normal)} />
        </g>
      ))}
    </svg>
  );
}

function RunArt() {
  const draw = useDraw();
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 56 56" className="size-14" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.circle cx="22" cy="30" r="15" stroke={STROKE} strokeWidth="2" {...draw(0, DURATION.crawl)} />
      <motion.path d="M22 30v-7" stroke={STROKE} strokeWidth="2" initial={reduce ? false : { rotate: 0 }} whileInView={{ rotate: 360 }} viewport={{ once: true }} style={{ originX: 0.5, originY: 1 }} transition={{ duration: DURATION.crawl * 1.4, ease: EASE.inOut, delay: 0.3 }} />
      <path d="M22 30h5" stroke={STROKE} strokeWidth="2" />
      <motion.g initial={reduce ? false : { opacity: 0, x: -12, y: 10 }} whileInView={{ opacity: 1, x: 0, y: 0 }} viewport={{ once: true }} transition={{ ...SPRING.gentle, delay: 1.3 }}>
        <path d="M37 13l14-6-5 15-3-6z" stroke={VIOLET} strokeWidth="2" fill="#ede9fe" />
        <path d="M43 16l-6-3" stroke={VIOLET} strokeWidth="2" />
      </motion.g>
    </svg>
  );
}

type Card = { n: number; title: string; art: ReactNode; body: ReactNode; tour?: string };

const CARDS: Card[] = [
  { n: 1, title: "You describe it", art: <DescribeArt />, body: <>One sentence, in your own words: what to look at, what to tell you, and how often.</> },
  {
    n: 2,
    title: "It’s built and tested",
    tour: "how-build",
    art: <BuildArt />,
    body: (
      <>
        The factory assembles the agent, does a <Term id="dry-run">test run</Term> on real data, and fixes anything that fails before you ever see it.
      </>
    ),
  },
  {
    n: 3,
    title: "It runs and reports",
    tour: "how-run",
    art: <RunArt />,
    body: (
      <>
        It works on its own <Term id="schedule">schedule</Term> and posts a short summary to Slack. If a source changes, it repairs itself.
      </>
    ),
  },
];

function HowCard({ card }: { card: Card }) {
  const [play, setPlay] = useState(0);
  return (
    <StaggerItem as="li" className="flex">
      <motion.div
        data-tour={card.tour}
        onMouseEnter={() => setPlay((p) => p + 1)}
        whileHover={{ y: -3 }}
        transition={SPRING.snappy}
        className="relative flex w-full flex-col gap-3 rounded-[4px] border border-stone-300 bg-[#FBFAF7] p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] hover:border-stone-500 hover:shadow-[0_14px_30px_-20px_rgba(28,25,23,0.5)] sm:p-5"
      >
        <div className="flex items-start justify-between">
          <span key={play}>{card.art}</span>
          <span className="font-mono text-[12px] tabular-nums text-stone-400">{card.n}/3</span>
        </div>
        <h3 className="text-[15px] font-semibold text-stone-900">{card.title}</h3>
        <p className="text-[14px] leading-relaxed text-stone-600">{card.body}</p>
      </motion.div>
    </StaggerItem>
  );
}

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="min-w-0">
      <h2 id="how-heading" className="text-[20px] font-semibold tracking-[-0.01em] text-stone-900">
        How it works
      </h2>
      <div className="relative mt-4">
        {/* The conveyor: a dashed rail behind the three cards (desktop only), so they read as one line of work. */}
        <span aria-hidden className="absolute inset-x-6 top-1/2 hidden border-t-2 border-dashed border-stone-300 md:block" />
        <Stagger as="ol" gap="loose" className="relative grid gap-3 md:grid-cols-3 md:gap-5">
          {CARDS.map((c) => (
            <HowCard key={c.n} card={c} />
          ))}
        </Stagger>
      </div>
      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-stone-600">
        <Wrench className="size-4 text-violet-700" aria-hidden />
        If it breaks, it fixes itself.
        <Link
          href="/tour"
          data-tour="how-repair"
          className="rounded-[2px] font-medium text-violet-700 underline decoration-violet-300 underline-offset-[3px] hover:text-violet-900 hover:decoration-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60"
        >
          Watch it happen in the tour
        </Link>
      </p>
    </section>
  );
}
