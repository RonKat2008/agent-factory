"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getFeed, getOutbox, runNow } from "@/lib/api-client";
import type { FeedEvent, OutboxMessage } from "@/lib/types";
import { getTour, tourAction } from "./tour-api";
import type { TourAction, TourSnapshot } from "./tour-api";

const FEED_POLL_MS = 1500;
const OUTBOX_POLL_MS = 2500;
const STORE_KEY = "af-tour-run";
const SKEW_MS = 1500;
const MAX_RESTORE_AGE_MS = 3 * 60 * 1000;

type Stored = { startedAt: string; publishedAt?: string };
const readStore = (): Stored | null => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null") as Stored | null;
  } catch {
    return null;
  }
};
const writeStore = (s: Stored | null) => {
  try {
    if (s) sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* storage unavailable: fine */
  }
};

export function useTour() {
  const [snap, setSnap] = useState<TourSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);
  const [pending, setPending] = useState<TourAction | "run" | null>(null);
  const [cooldown, setCooldown] = useState<{ action: TourAction; until: number } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [clientStart, setClientStart] = useState<number | null>(null);

  const watcherId = snap?.watcher?.id ?? null;

  const refresh = useCallback(async () => {
    try {
      setSnap(await getTour());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "tour unavailable");
    }
  }, []);

  useEffect(() => {
    const stored = readStore();
    const age = stored ? Date.now() - Date.parse(stored.startedAt) : Infinity;
    const isFresh = stored !== null && Number.isFinite(age) && age >= 0 && age < MAX_RESTORE_AGE_MS;
    if (stored && !isFresh) writeStore(null);
    if (stored && isFresh) queueMicrotask(() => {
      setStartedAt(stored.startedAt);
      setPublishedAt(stored.publishedAt ?? null);
      setClientStart(Date.parse(stored.startedAt));
    });
    queueMicrotask(() => void refresh());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [refresh]);

  const repaired = events.find((e) => e.type === "repaired") ?? null;
  const stuck = events.find((e) => e.type === "needs_human") ?? null;
  const settled = repaired !== null || stuck !== null;

  // A finished run must not be restored on the next visit.
  useEffect(() => {
    if (settled) writeStore(null);
  }, [settled]);

  useEffect(() => {
    if (!watcherId || !startedAt || settled) return;
    let alive = true;
    const since = Date.parse(startedAt) - SKEW_MS;
    const load = async () => {
      try {
        const all = await getFeed({ agentId: watcherId });
        if (!alive) return;
        setEvents(
          all
            .filter((e) => Date.parse(e.createdAt) >= since)
            .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
        );
      } catch {
        /* keep last good data */
      }
    };
    void load();
    const t = setInterval(load, FEED_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [watcherId, startedAt, settled]);

  useEffect(() => {
    if (!watcherId) return;
    let alive = true;
    const load = async () => {
      try {
        const all = await getOutbox();
        if (alive) setOutbox(all.filter((m) => m.agentId === watcherId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      } catch {
        /* keep last good data */
      }
    };
    void load();
    const t = setInterval(load, OUTBOX_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [watcherId]);

  const act = useCallback(
    async (action: TourAction) => {
      setPending(action);
      const res = await tourAction(action);
      setPending(null);
      if (!res.ok) {
        if (res.retryInSec) setCooldown({ action, until: Date.now() + res.retryInSec * 1000 });
        else toast.error(res.error);
        return false;
      }
      setCooldown(null);
      if (action === "break") {
        setEvents([]);
        setPublishedAt(null);
        setStartedAt(res.startedAt);
        setClientStart(Date.now());
        writeStore({ startedAt: res.startedAt });
      } else if (action === "publish") {
        const at = new Date().toISOString();
        setPublishedAt(at);
        writeStore({ startedAt: startedAt ?? at, publishedAt: at });
      } else {
        setStartedAt(null);
        setPublishedAt(null);
        setEvents([]);
        setOutbox([]);
        writeStore(null);
        toast.success("Demo reset: Acme restored, watcher back on v1");
      }
      setPreviewKey((k) => k + 1);
      await refresh();
      return true;
    },
    [refresh, startedAt],
  );

  const runWatcher = useCallback(async () => {
    if (!watcherId) return;
    setPending("run");
    try {
      await runNow(watcherId);
      toast.success("Run started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start a run");
    } finally {
      setPending(null);
    }
  }, [watcherId]);

  const cooldownSec = cooldown ? Math.max(0, Math.ceil((cooldown.until - now) / 1000)) : 0;
  const elapsedMs = !startedAt
    ? 0
    : repaired || stuck
      ? Date.parse((repaired ?? stuck)!.createdAt) - Date.parse(startedAt)
      : now - (clientStart ?? Date.parse(startedAt));

  return {
    snap, loadError, startedAt, publishedAt, events, outbox, pending, previewKey, now,
    repaired, stuck, elapsedMs: Math.max(0, elapsedMs),
    cooldownAction: cooldownSec > 0 ? cooldown!.action : null, cooldownSec,
    act, runWatcher,
  };
}
