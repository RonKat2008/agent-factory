import { guard, json, jsonError } from "@/lib/api-util";
import { isAdmin } from "@/lib/demo-acme";
import { seedChainAgent } from "@/lib/demo-actions";
import { createAgent, insertVersion, listAgents, logEvent, updateAgent } from "@/lib/repo";
import { baselineMemory } from "@/lib/runtime/run-agent";
import { nextRunAt } from "@/lib/runtime/schedule";
import { startAgentRun } from "@/lib/runtime/start-run";
import { SEED_NAMES, seedAgents } from "@/lib/seed-specs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Idempotent: creates the 3 demo agents (v1, live) unless they exist, then kicks a first run of each new one. */
export function POST(request: Request): Promise<Response> {
  return guard("POST /api/demo/seed", async () => {
    if (!isAdmin(request)) return jsonError("unauthorized", 401);
    const existing = new Set((await listAgents()).map((a) => a.name));
    const created: { agentId: string; name: string; runId: string | null }[] = [];
    const skipped: string[] = [];
    for (const { request: req, spec } of seedAgents()) {
      if (existing.has(spec.name)) {
        skipped.push(spec.name);
        continue;
      }
      const agentId = await createAgent({ name: spec.name, request: req, schedule: spec.schedule, status: "building", requiresApproval: spec.requiresApproval });
      const version = await insertVersion({ agentId, spec, reason: "initial build", createdBy: "user", parentVersion: null });
      // next_run_at is the next scheduled slot: the manual run below is the "now" run (avoids a cron double-run).
      await updateAgent(agentId, { currentVersion: version, status: "live", nextRunAt: nextRunAt(spec.schedule) });
      await logEvent(agentId, "went_live", "Went live (seeded)");
      // The Acme watcher starts from the current changelog, so its runs report only newly published entries.
      if (spec.name === SEED_NAMES.watcher) await baselineMemory(agentId, spec);
      const runId = await startAgentRun(agentId, "manual");
      created.push({ agentId, name: spec.name, runId });
    }
    // The chained deep-dive needs the watcher's id, so it is seeded after the base agents (no first run).
    const chain = await seedChainAgent();
    return json({ ok: true, created, skipped, chain });
  });
}
