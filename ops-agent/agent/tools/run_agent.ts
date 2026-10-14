import { defineTool } from "eve/tools";
import { z } from "zod";
import { agentLink, factory } from "../lib/factory";

export default defineTool({
  description: "Trigger a manual run of an agent now (same as 'Run now' on the dashboard). Returns the run id.",
  inputSchema: z.object({ id: z.string().min(1).describe("Agent id") }),
  label: { start: ({ id }) => `Run agent ${id.slice(0, 8)}` },
  async execute({ id }) {
    const res = await factory<{ runId: string }>(`/api/agents/${encodeURIComponent(id)}/run`, { method: "POST" });
    return { ...res, link: agentLink(id) };
  },
});
