import { defineTool } from "eve/tools";
import { z } from "zod";
import { agentLink, factory, summarizeAgent } from "../lib/factory";

export default defineTool({
  description: "Resume a paused agent so it runs on its schedule again.",
  inputSchema: z.object({ id: z.string().min(1).describe("Agent id") }),
  label: { start: ({ id }) => `Resume agent ${id.slice(0, 8)}` },
  async execute({ id }) {
    const res = await factory<{ agent: Record<string, unknown> }>(`/api/agents/${encodeURIComponent(id)}/pause`, {
      method: "POST",
      body: { paused: false },
    });
    return { agent: summarizeAgent(res.agent), link: agentLink(id) };
  },
});
