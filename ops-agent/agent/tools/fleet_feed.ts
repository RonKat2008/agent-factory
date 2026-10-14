import { defineTool } from "eve/tools";
import { z } from "zod";
import { agentLink, factory, factoryUrl } from "../lib/factory";

export default defineTool({
  description:
    "Recent fleet events (builds, runs, failures, self-fixes, edits, approvals), newest first, max 50. Optionally filter to one agent or to events since an ISO timestamp.",
  inputSchema: z.object({
    agentId: z.string().optional().describe("Only events for this agent id"),
    since: z.string().optional().describe("ISO timestamp; only events after this time"),
    sinceHours: z.number().positive().max(720).optional().describe("Only events from the last N hours (overrides since)"),
  }),
  label: { start: () => "Read fleet feed" },
  async execute({ agentId, since, sinceHours }) {
    const qs = new URLSearchParams();
    if (agentId) qs.set("agentId", agentId);
    const sinceIso = sinceHours ? new Date(Date.now() - sinceHours * 3_600_000).toISOString() : since;
    if (sinceIso) qs.set("since", sinceIso);
    const q = qs.toString();
    const data = await factory<{ events: Record<string, unknown>[] }>(`/api/feed${q ? `?${q}` : ""}`);
    return {
      factoryUrl: factoryUrl(),
      now: new Date().toISOString(),
      since: sinceIso ?? null,
      events: data.events.map((e) => ({
        type: e.type,
        agentName: e.agentName,
        agentId: e.agentId,
        message: e.message,
        version: (e.data as { version?: unknown } | null)?.version,
        createdAt: e.createdAt,
        link: typeof e.agentId === "string" ? agentLink(e.agentId) : undefined,
      })),
    };
  },
});
