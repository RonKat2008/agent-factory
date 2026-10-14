"use client";

import { useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { SPRING } from "./tokens";

type NumberTickerProps = {
  value: number;
  /** Formats the in-flight value, e.g. (n) => `$${n.toFixed(4)}`. Defaults to rounded integer. */
  format?: (n: number) => string;
  /** Start value for the first animation (defaults to `value`, i.e. no animation on mount). */
  from?: number;
  className?: string;
};

const roundInt = (n: number) => Math.round(n).toLocaleString();

/** Spring-tweens to `value` whenever it changes. Screen readers get the final value only. */
export function NumberTicker({ value, format = roundInt, from, className }: NumberTickerProps) {
  const reduce = useReducedMotion();
  const spring = useSpring(from ?? value, SPRING.ticker);
  const [shown, setShown] = useState(from ?? value);

  useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, reduce, spring]);

  useMotionValueEvent(spring, "change", (v) => setShown(v));

  return (
    <span className={className}>
      <span aria-hidden className="tabular-nums">
        {format(shown)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
