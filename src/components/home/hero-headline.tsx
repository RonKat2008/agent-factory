"use client";

import { motion, useReducedMotion } from "motion/react";
import { DISTANCE, DURATION, EASE, STAGGER } from "@/components/motion";

type Props = { text: string; id?: string; className?: string };

const CARET_BLINKS = 4;

/** The page headline, landing word by word, then a violet caret that blinks a few times like a text box waiting. */
export function HeroHeadline({ text, id, className }: Props) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const caretDelay = words.length * STAGGER.loose + DURATION.normal;
  return (
    <h1 id={id} className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          aria-hidden
          className="inline-block whitespace-pre"
          initial={reduce ? false : { opacity: 0, y: DISTANCE.md }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE.out, delay: i * STAGGER.loose }}
        >
          {i < words.length - 1 ? `${w} ` : w}
        </motion.span>
      ))}
      <motion.span
        aria-hidden
        className="ml-[0.08em] inline-block h-[0.82em] w-[0.09em] translate-y-[0.08em] rounded-[1px] bg-violet-600"
        initial={{ opacity: 0 }}
        animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 1, 0, 0, 1] }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: DURATION.crawl, delay: caretDelay, repeat: CARET_BLINKS, ease: "linear", times: [0, 0.05, 0.5, 0.55, 0.95, 1] }
        }
      />
    </h1>
  );
}
