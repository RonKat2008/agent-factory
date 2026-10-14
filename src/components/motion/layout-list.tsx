"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { DISTANCE, DURATION, EASE, SPRING } from "./tokens";

type LayoutListProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  as?: "ul" | "ol" | "div";
  className?: string;
  itemClassName?: string;
  /** Where new rows come from: "top" for newest-first feeds, "bottom" for timelines. */
  enterFrom?: "top" | "bottom";
};

/**
 * Animated list for feeds and boards: new rows slide/fade in, removed rows fade out,
 * reordered rows glide to their new position. Rows already present on mount do not animate.
 * Keep lists ≤ ~40 rows (layout animation cost).
 */
export function LayoutList<T>({
  items,
  getKey,
  renderItem,
  as = "ul",
  className,
  itemClassName,
  enterFrom = "top",
}: LayoutListProps<T>) {
  const Comp = as;
  const Item = as === "div" ? motion.div : motion.li;
  const dy = enterFrom === "top" ? -DISTANCE.sm : DISTANCE.sm;
  return (
    <Comp className={className}>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item, i) => (
          <Item
            key={getKey(item)}
            layout="position"
            className={itemClassName}
            initial={{ opacity: 0, y: dy }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: DURATION.fast, ease: EASE.in } }}
            transition={SPRING.gentle}
          >
            {renderItem(item, i)}
          </Item>
        ))}
      </AnimatePresence>
    </Comp>
  );
}
