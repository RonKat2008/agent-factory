import { defineTool } from "eve/tools";
import { z } from "zod";
import { factory, factoryUrl, summarizeAgent } from "../lib/factory";

export default defineTool({
  description:
    "List every agent in the Agent Factory fleet with status, current version, health (0-100), success rate, repair count, schedule, and dashboard link.",
  inputSchema: z.object({}),
  label: { start: () => "List fleet agents" },
  async execute() {
    const data = await factory<{ agents: Record<string, unknown>[] }>("/api/agents");
    return { factoryUrl: factoryUrl(), count: data.agents.length, agents: data.agents.map(summarizeAgent) };
  },
});
