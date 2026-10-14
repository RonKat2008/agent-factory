// Client for the public /api/demo/tour route (no admin key). Kept local: api-client.ts is not ours to edit.
import type { Agent } from "@/lib/types";

export type TourAction = "break" | "publish" | "reset";
export type TourSnapshot = { acme: { broken: boolean; published: number }; watcher: Agent | null };
export type TourResult =
  | { ok: true; startedAt: string; runId: string | null; watcherId: string | null }
  | { ok: false; error: string; retryInSec: number | null };

export async function getTour(): Promise<TourSnapshot> {
  const res = await fetch("/api/demo/tour", { cache: "no-store" });
  if (!res.ok) throw new Error(`tour unavailable (${res.status})`);
  return (await res.json()) as TourSnapshot;
}

export async function tourAction(action: TourAction): Promise<TourResult> {
  try {
    const res = await fetch("/api/demo/tour", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      retryInSec?: number;
      startedAt?: string;
      runId?: string | null;
      watcherId?: string | null;
    };
    if (!res.ok) return { ok: false, error: body.error ?? `${res.status} ${res.statusText}`, retryInSec: body.retryInSec ?? null };
    return { ok: true, startedAt: body.startedAt ?? new Date().toISOString(), runId: body.runId ?? null, watcherId: body.watcherId ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error", retryInSec: null };
  }
}
