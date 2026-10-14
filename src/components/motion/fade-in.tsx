"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";
import { DISTANCE, DURATION, EASE, SPRING, STAGGER } from "./tokens";

type FadeInProps = {
  children: ReactNode;
  /** Seconds before the entrance starts. */
  delay?: number;
  /** Vertical travel in px (0 = opacity only). */
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span" | "header";
};

/** One-shot entrance: fade + small rise. Opacity-only under reduced motion (via MotionProvider). */
export function FadeIn({ children, delay = 0, y = DISTANCE.sm, className, as = "div" }: FadeInProps) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.normal, ease: EASE.out, delay }}
    >
      {children}
    </Comp>
  );
}

const containerVariants = (gap: number, delay: number): Variants => ({
  hidden: {},
  shown: { transition: { staggerChildren: gap, delayChildren: delay } },
});

const itemVariants: Variants = {
  hidden: { opacity: 0, y: DISTANCE.md },
  shown: { opacity: 1, y: 0, transition: SPRING.gentle },
};

type StaggerProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol" | "section";
  /** Interval between children. */
  gap?: keyof typeof STAGGER;
  delay?: number;
};

/** Parent for a group of <StaggerItem>s that enter one after another. Plays once on mount. */
export function Stagger({ children, className, as = "div", gap = "normal", delay = 0 }: StaggerProps) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={containerVariants(STAGGER[gap], delay)} initial="hidden" animate="shown">
      {children}
    </Comp>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "section" | "article";
};

export function StaggerItem({ children, className, as = "div" }: StaggerItemProps) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={itemVariants}>
      {children}
    </Comp>
  );
}
