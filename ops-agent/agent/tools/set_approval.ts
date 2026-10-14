import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { agentLink, factory, summarizeAgent } from "../lib/factory";

export default defineTool({
  description:
    "Turn human approval of an agent's outgoing messages on or off. When on, each run waits for a person to approve before sending. Requires human approval.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Agent id"),
    requiresApproval: z.boolean(),
    name: z.string().optional().describe("Agent name, shown in the approval prompt"),
  }),
  approval: {
    request: always(),
    prompt: ({ input }) =>
      `${input.requiresApproval ? "Require" : "Stop requiring"} approval for ${input.name ?? input.id}?`,
  },
  label: { start: ({ name, id }) => `Set approval on ${name ?? id.slice(0, 8)}` },
  async execute({ id, requiresApproval }) {
    const res = await factory<{ agent: Record<string, unknown> }>(
      `/api/agents/${encodeURIComponent(id)}/approval`,
      { method: "POST", body: { requiresApproval } },
    );
    return { agent: summarizeAgent(res.agent), link: agentLink(id) };
  },
});
