"use client";

import { useSyncExternalStore } from "react";
import { ONBOARDED_KEY } from "./steps";

// Tiny module store so any component (HelpMenu, a button on the home page) can replay the
// intro without a React context. The overlay subscribes to `requests`.
let requests = 0;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Opens the guided intro again, from the first step available. */
export function replayIntro(): void {
  requests += 1;
  listeners.forEach((l) => l());
}

/** Counter that increments on every replayIntro() call (0 = never requested). */
export function useReplayRequests(): number {
  return useSyncExternalStore(
    subscribe,
    () => requests,
    () => 0,
  );
}

export function hasOnboarded(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true; // storage blocked: don't nag on every page load
  }
}

export function markOnboarded(): void {
  try {
    window.localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    /* storage blocked: nothing to persist */
  }
}
