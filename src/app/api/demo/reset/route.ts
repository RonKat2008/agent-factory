import { guard, json, jsonError } from "@/lib/api-util";
import { isAdmin, resetAcmeState } from "@/lib/demo-acme";
import { getActiveVersion, getAgentDetail, listAgents, memoryClear, setVersionStatus, updateAgent } from "@/lib/repo";
import { baselineMemory } from "@/lib/runtime/run-agent";
import { SEED_NAMES } from "@/lib/seed-specs";

export const dynamic = "force-dynamic";

const RESET_DELAY_MS = 15 * 60 * 1000;

/** Restores Acme and rolls the Competitor watcher back to v1 with empty memory. */
export function POST(request: Request): Promise<Response> {
  return guard("POST /api/demo/reset", async () => {
    if (!isAdmin(request)) return jsonError("unauthorized", 401);
    await resetAcmeState();
    const watcher = (await listAgents()).find((a) => a.name === SEED_NAMES.watcher);
    if (watcher) {
      const detail = await getAgentDetail(watcher.id);
      for (const v of detail?.versions ?? []) {
        await setVersionStatus(watcher.id, v.version, v.version === 1 ? "active" : "rejected");
      }
      await updateAgent(watcher.id, { currentVersion: 1, status: "live", nextRunAt: new Date(Date.now() + RESET_DELAY_MS) });
      await memoryClear(watcher.id);
      // Re-baseline so the next run reports only entries published after the reset (a first run would summarize all 6).
      const v1 = await getActiveVersion(watcher.id);
      const baseline = v1 ? await baselineMemory(watcher.id, v1.spec) : { ok: false, error: "no v1" };
      return json({ ok: true, watcherId: watcher.id, baseline });
    }
    return json({ ok: true, watcherId: null });
  });
}
