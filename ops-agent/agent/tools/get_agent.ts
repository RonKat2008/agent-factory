import { defineTool } from "eve/tools";
import { z } from "zod";
import { factory, factoryUrl, summarizeAgent, summarizeRun } from "../lib/factory";

const MAX_RUNS = 8;

export default defineTool({
  description:
    "Get one agent's detail: status, plan, every version with the reason it was created (build, edit, self-fix) and its status, the most recent runs, and recent failures with failing steps and tests. Use this to explain why an agent broke or how it was repaired.",
  inputSchema: z.object({ id: z.string().min(1).describe("Agent id from list_agents") }),
  label: { start: ({ id }) => `Inspect agent ${id.slice(0, 8)}` },
  async execute({ id }) {
    const d = await factory<{
      agent: Record<string, unknown>;
      versions?: Record<string, unknown>[];
      runs?: Record<string, unknown>[];
    }>(`/api/agents/${encodeURIComponent(id)}`);
    const runs = (d.runs ?? []).map(summarizeRun);
    return {
      factoryUrl: factoryUrl(),
      agent: { ...summarizeAgent(d.agent), request: d.agent.request, plan: d.agent.plan },
      versions: (d.versions ?? []).map((v) => ({
        version: v.version,
        parentVersion: v.parentVersion,
        status: v.status,
        reason: v.reason,
        createdBy: v.createdBy,
        createdAt: v.createdAt,
      })),
      lastRuns: runs.slice(0, MAX_RUNS),
      failures: runs.filter((r) => r.status === "failed").slice(0, MAX_RUNS),
    };
  },
});
