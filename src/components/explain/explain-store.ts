"use client";

import { useSyncExternalStore } from "react";

// Explain-mode preference, persisted in localStorage and shared by every <Term> and toggle.
const KEY = "af_explain";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let current: boolean | null = null;

function snapshot(): boolean {
  if (current === null) current = read();
  return current;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    current = read();
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setExplainMode(on: boolean): void {
  current = on;
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* private mode: keep the in-memory value */
  }
  listeners.forEach((l) => l());
}

export function toggleExplainMode(): void {
  setExplainMode(!snapshot());
}

/** Explain mode on/off. Always false during SSR and hydration. */
export function useExplainMode(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
