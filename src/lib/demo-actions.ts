// Shared demo actions used by the key-gated /api/demo/* routes and the public tour route.
import { extraEntries, resetAcmeState, setAcmeState, getAcmeState } from "@/lib/demo-acme";
import {
  createAgent,
  deleteVersionsAbove,
  getActiveVersion,
  getAgentDetail,
  insertVersion,
  listAgents,
  logEvent,
  memoryClear,
  setVersionStatus,
  updateAgent,
} from "@/lib/repo";
import { getCustomConnector } from "@/lib/repo-connectors";
import { baselineMemory } from "@/lib/runtime/run-agent";
import { nextRunAt } from "@/lib/runtime/schedule";
import { chainSeedAgent, SEED_NAMES, type ChainResearch } from "@/lib/seed-specs";
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
    if (v.version === 1) await setVersionStatus(watcher.id, 1, "active");
  }
  // Remove later versions (not just reject) so the next repair ships v2 again; repair history lives in events.
  await deleteVersionsAbove(watcher.id, 1);
  await updateAgent(watcher.id, { currentVersion: 1, status: "live", nextRunAt: new Date(Date.now() + RESET_DELAY_MS) });
  await memoryClear(watcher.id);
  // Re-baseline so the next run reports only entries published after the reset (a first run would summarize all 6).
  const v1 = await getActiveVersion(watcher.id);
  const baseline = v1 ? await baselineMemory(watcher.id, v1.spec) : { ok: false, error: "no v1" };
  return { ok: true, watcherId: watcher.id, baseline };
}

const EXA_SLUG = "exa_search";
const EXA_ACTION = "web_search_exa";

async function chainResearch(): Promise<ChainResearch> {
  try {
    const exa = await getCustomConnector(EXA_SLUG);
    const action = exa?.actions.find((a) => a.name === EXA_ACTION);
    if (action && action.params.some((p) => p.name === "query")) return { kind: "exa", connector: EXA_SLUG, action: EXA_ACTION };
  } catch (e) {
    console.error("[demo] exa lookup failed:", (e as Error).message);
  }
  return { kind: "hn" };
}

/**
 * Idempotent: adds the chained "Competitor deep-dive" (triggered by the Competitor watcher), live, v1.
 * No first run: it fires the next time the watcher posts.
 */
export async function seedChainAgent(): Promise<
  { ok: true; created: boolean; agentId: string; watcherId: string; research: ChainResearch["kind"] } | { ok: false; error: string }
> {
  const agents = await listAgents();
  const watcher = agents.find((a) => a.name === SEED_NAMES.watcher);
  if (!watcher) return { ok: false, error: `"${SEED_NAMES.watcher}" not found — seed the demo first` };
  const existing = agents.find((a) => a.name === SEED_NAMES.deepDive);
  if (existing) {
    const active = await getActiveVersion(existing.id);
    const research = active?.spec.steps.some((s) => s.block === "connector") ? "exa" : "hn";
    return { ok: true, created: false, agentId: existing.id, watcherId: watcher.id, research };
  }
  const research = await chainResearch();
  const { request, spec } = chainSeedAgent(watcher.id, research);
  const agentId = await createAgent({ name: spec.name, request, schedule: spec.schedule, status: "building", requiresApproval: spec.requiresApproval });
  const version = await insertVersion({ agentId, spec, reason: "initial build", createdBy: "user", parentVersion: null });
  await updateAgent(agentId, { currentVersion: version, status: "live", nextRunAt: nextRunAt(spec.schedule) });
  await logEvent(agentId, "went_live", `Went live (seeded) — runs whenever ${watcher.name} posts`);
  return { ok: true, created: true, agentId, watcherId: watcher.id, research: research.kind };
}
