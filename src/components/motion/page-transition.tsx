"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DISTANCE, DURATION, EASE } from "./tokens";
import { useIsHydrating } from "./use-hydrating";

/**
 * Enter-only route transition. Keyed on pathname so each page fades/rises in on navigation.
 * The first (server-rendered) paint is not animated. No exit animation: App Router swaps
 * children immediately, so an exit would animate the *new* page out.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const first = useIsHydrating();
  return (
    <motion.div
      key={pathname}
      initial={first ? false : { opacity: 0, y: DISTANCE.sm }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.normal, ease: EASE.out }}
    >
      {children}
    </motion.div>
  );
}
