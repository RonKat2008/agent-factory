"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * True during server render and the hydration pass; false for any client-side mount.
 * Use it to skip entrance animations on content the server already painted, so `initial`
 * matches server output and nothing flashes, while client navigations still animate.
 */
export function useIsHydrating(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => false,
    () => true,
  );
}
