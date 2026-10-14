"use client";

import { useEffect, useRef, useState } from "react";

/** Tweens a number to `value` over ~600ms; instant when the user prefers reduced motion. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const dur = reduced || from === value ? 0 : 600;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = dur === 0 ? 1 : Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (value - from) * eased;
      fromRef.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span aria-label={format(value)}>{format(shown)}</span>;
}
