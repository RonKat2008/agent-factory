import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { agentLink, factory, summarizeAgent } from "../lib/factory";

export default defineTool({
  description: "Pause a live agent so it stops running on its schedule. Requires human approval.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Agent id"),
    name: z.string().optional().describe("Agent name, shown in the approval prompt"),
  }),
  approval: {
    request: always(),
    prompt: ({ input }) => `Pause agent ${input.name ?? input.id}?`,
  },
  label: { start: ({ name, id }) => `Pause ${name ?? id.slice(0, 8)}` },
  async execute({ id }) {
    const res = await factory<{ agent: Record<string, unknown> }>(`/api/agents/${encodeURIComponent(id)}/pause`, {
      method: "POST",
      body: { paused: true },
    });
    return { agent: summarizeAgent(res.agent), link: agentLink(id) };
  },
});
