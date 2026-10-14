// Shared demo actions used by the key-gated /api/demo/* routes and the public tour route.
import { extraEntries, resetAcmeState, setAcmeState, getAcmeState } from "@/lib/demo-acme";
import { getActiveVersion, getAgentDetail, listAgents, memoryClear, setVersionStatus, updateAgent } from "@/lib/repo";
import { baselineMemory } from "@/lib/runtime/run-agent";
import { SEED_NAMES } from "@/lib/seed-specs";
import type { Agent } from "@/lib/types";

const RESET_DELAY_MS = 15 * 60 * 1000;

export async function findWatcher(): Promise<Agent | null> {
  return (await listAgents()).find((a) => a.name === SEED_NAMES.watcher) ?? null;
}

/** Acme "redesigns": changelog moves to /demo/acme/updates and the old URL 404s. */
export async function breakAcme() {
  await setAcmeState({ broken: true });
  return { ok: true, broken: true };
}

/** Acme ships the next entry from the pool (appears at the top of the changelog). */
export async function publishAcme() {
  const state = await getAcmeState();
  const published = Math.min(state.published + 1, extraEntries.length);
  await setAcmeState({ published });
  return { ok: true, published };
}

/** Restores Acme and rolls the Competitor watcher back to v1 with empty memory. */
export async function resetDemo() {
  await resetAcmeState();
  const watcher = await findWatcher();
  if (!watcher) return { ok: true, watcherId: null };
  const detail = await getAgentDetail(watcher.id);
  for (const v of detail?.versions ?? []) {
    await setVersionStatus(watcher.id, v.version, v.version === 1 ? "active" : "rejected");
  }
  await updateAgent(watcher.id, { currentVersion: 1, status: "live", nextRunAt: new Date(Date.now() + RESET_DELAY_MS) });
  await memoryClear(watcher.id);
  // Re-baseline so the next run reports only entries published after the reset (a first run would summarize all 6).
  const v1 = await getActiveVersion(watcher.id);
  const baseline = v1 ? await baselineMemory(watcher.id, v1.spec) : { ok: false, error: "no v1" };
  return { ok: true, watcherId: watcher.id, baseline };
}
