"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type ChatItem, applyEvent, parseLines, signalOf } from "./events";

export type ChatStatus = "idle" | "working" | "awaiting-input";
const MAX_RECONNECTS = 12;
const RATE_LIMIT_MS = 60_000;
const STORAGE_KEY = "ops-chat-v1";
const MAX_STORED_ITEMS = 120;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type Stored = { sessionId: string | null; seen: number; items: ChatItem[]; status: ChatStatus; lastText: string };
const EMPTY: Stored = { sessionId: null, seen: 0, items: [], status: "idle", lastText: "" };

function load(): Stored {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const s = raw ? (JSON.parse(raw) as Stored) : null;
    return s && Array.isArray(s.items) ? s : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(s: Stored): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, items: s.items.slice(-MAX_STORED_ITEMS) }));
  } catch {
    /* storage unavailable: chat still works, it just won't survive a reload */
  }
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`/api/ops/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function httpError(res: Response): Promise<HttpError> {
  const j = (await res.json().catch(() => null)) as { error?: string } | null;
  return new HttpError(j?.error ?? `Request failed (${res.status})`, res.status);
}

/** One eve session per chat. The stream replays from event 0, so `seen` counts events already applied. */
export function useOpsChat() {
  const [init] = useState(load);
  const [items, setItems] = useState<ChatItem[]>(init.items);
  const [status, setStatus] = useState<ChatStatus>(init.status);
  const sessionRef = useRef<string | null>(init.sessionId);
  const seenRef = useRef(init.seen);
  const lastTextRef = useRef(init.lastText);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);

  useEffect(() => { save({ sessionId: sessionRef.current, seen: seenRef.current, items, status, lastText: lastTextRef.current }); }, [items, status]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const pushError = useCallback((err: unknown, fallback: string) => {
    const limited = err instanceof HttpError && err.status === 429;
    const text = limited ? "You're sending messages too fast." : err instanceof Error ? err.message : fallback;
    setItems((c) => [...c, { kind: "error", id: `x${nextId.current++}:${Date.now()}`, text, retryUntil: limited ? Date.now() + RATE_LIMIT_MS : undefined, retryable: true }]);
  }, []);

  /** Reads the stream until the session parks (done) or needs a human (awaiting-input). */
  const pump = useCallback(async (sessionId: string, ctl: AbortController) => {
    setStatus("working");
    for (let attempt = 0; attempt <= MAX_RECONNECTS && !ctl.signal.aborted; attempt++) {
      let skip = seenRef.current;
      try {
        const res = await fetch(`/api/ops/stream?sessionId=${encodeURIComponent(sessionId)}`, { signal: ctl.signal, cache: "no-store" });
        if (!res.ok || !res.body) throw await httpError(res);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const { events, rest } = parseLines(buf);
          buf = rest;
          for (const ev of events) {
            if (skip > 0) { skip--; continue; }
            seenRef.current++;
            setItems((c) => applyEvent(c, ev));
            const sig = signalOf(ev);
            if (sig !== "continue") {
              void reader.cancel().catch(() => {});
              setStatus(sig === "done" ? "idle" : "awaiting-input");
              return;
            }
          }
        }
      } catch (err) {
        if (ctl.signal.aborted) return;
        if (attempt === MAX_RECONNECTS) { pushError(err, "Lost connection to Fleet Ops"); break; }
      }
      await sleep(700); // stream hit the 60s proxy limit or dropped: resume from the cursor
    }
    if (!ctl.signal.aborted) setStatus("idle");
  }, [pushError]);

  // A reload mid-turn: pick the stream back up from the stored cursor.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || init.status !== "working" || !init.sessionId) return;
    resumed.current = true;
    const ctl = new AbortController();
    abortRef.current = ctl;
    void pump(init.sessionId, ctl);
  }, [init, pump]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionRef.current) return sessionRef.current;
    const res = await post("session", {});
    if (!res.ok) throw await httpError(res);
    const { sessionId } = (await res.json()) as { sessionId: string };
    sessionRef.current = sessionId;
    return sessionId;
  }, []);

  /** Posts with a short retry: a brand-new session can answer 409 while its inbox starts. */
  const postRetry = useCallback(async (path: string, body: unknown): Promise<void> => {
    for (let i = 0; i < 6; i++) {
      const res = await post(path, body);
      if (res.ok) return;
      if (res.status !== 409 || i === 5) throw await httpError(res);
      await sleep(600);
    }
  }, []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || status !== "idle") return;
    lastTextRef.current = text;
    setItems((c) => [...c.filter((i) => i.kind !== "error"), { kind: "user", id: `u${nextId.current++}:${Date.now()}`, text }]);
    setStatus("working");
    try {
      const sessionId = await ensureSession();
      await postRetry("message", { sessionId, text });
      const ctl = new AbortController();
      abortRef.current = ctl;
      void pump(sessionId, ctl);
    } catch (err) {
      pushError(err, "Could not reach Fleet Ops");
      setStatus("idle");
    }
  }, [status, ensureSession, postRetry, pump, pushError]);

  /** Retries the last failed turn without duplicating the user's bubble. */
  const retry = useCallback(async () => {
    const text = lastTextRef.current;
    if (!text || status !== "idle") return;
    setItems((c) => c.filter((i) => i.kind !== "error"));
    setStatus("working");
    try {
      const sessionId = await ensureSession();
      await postRetry("message", { sessionId, text });
      const ctl = new AbortController();
      abortRef.current = ctl;
      void pump(sessionId, ctl);
    } catch (err) {
      pushError(err, "Could not reach Fleet Ops");
      setStatus("idle");
    }
  }, [status, ensureSession, postRetry, pump, pushError]);

  const respond = useCallback(async (requestId: string, approve: boolean) => {
    const sessionId = sessionRef.current;
    if (!sessionId) return;
    const key = `p:${requestId}`;
    setItems((c) => c.map((i) => (i.id === key && i.kind === "approval" ? { ...i, status: "sending" } : i)));
    try {
      await postRetry("approve", { sessionId, requestId, approve });
      setItems((c) => c.map((i) => (i.id === key && i.kind === "approval" ? { ...i, status: approve ? "approved" : "denied", decidedAt: Date.now() } : i)));
      const ctl = new AbortController();
      abortRef.current?.abort();
      abortRef.current = ctl;
      void pump(sessionId, ctl);
    } catch (err) {
      setItems((c) => c.map((i) => (i.id === key && i.kind === "approval" ? { ...i, status: "pending" } : i)));
      pushError(err, "Could not send your answer");
    }
  }, [postRetry, pump, pushError]);

  /** Stop: ask eve to cancel the turn; the stream then closes on its own. Falls back to a local abort. */
  const stop = useCallback(async () => {
    const sessionId = sessionRef.current;
    if (!sessionId) return;
    const res = await post("cancel", { sessionId }).catch(() => null);
    if (!res?.ok) {
      abortRef.current?.abort();
      setItems((c) => c.map((i) => (i.kind === "assistant" && !i.done ? { ...i, done: true } : i)));
      setStatus("idle");
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    sessionRef.current = null;
    seenRef.current = 0;
    lastTextRef.current = "";
    setItems([]);
    setStatus("idle");
  }, []);

  return { items, status, send, retry, respond, stop, reset };
}
