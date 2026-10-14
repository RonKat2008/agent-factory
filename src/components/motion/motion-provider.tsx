"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * App-wide motion settings. `reducedMotion="user"` makes every motion component drop
 * transform animations (keeping opacity) when the OS asks for reduced motion.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
