import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { agentLink, factory } from "../lib/factory";

export default defineTool({
  description:
    "Change what an agent does with a plain-English instruction (e.g. 'only flag security issues'). The factory creates a new version, dry-runs it and runs its tests; it goes live only if the tests pass. Requires human approval.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Agent id"),
    instruction: z.string().min(3).describe("Plain-English change request"),
    name: z.string().optional().describe("Agent name, shown in the approval prompt"),
  }),
  approval: {
    request: always(),
    prompt: ({ input }) => `Edit ${input.name ?? input.id}: "${input.instruction}"?`,
  },
  label: { start: ({ name, id }) => `Edit ${name ?? id.slice(0, 8)}` },
  async execute({ id, instruction }) {
    const res = await factory<{ version: unknown }>(`/api/agents/${encodeURIComponent(id)}/edit`, {
      method: "POST",
      body: { instruction },
    });
    return {
      ...res,
      note: "New version is being dry-run and tested; it becomes active only if tests pass. Check get_agent or fleet_feed for the outcome.",
      link: agentLink(id),
    };
  },
});
