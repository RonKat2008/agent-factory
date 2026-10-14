import { defineTool } from "eve/tools";
import { z } from "zod";
import { factory, factoryUrl } from "../lib/factory";

export default defineTool({
  description: "Fleet-wide stats: agents live, runs today, auto-repairs, total cost in USD.",
  inputSchema: z.object({}),
  label: { start: () => "Read fleet stats" },
  async execute() {
    const stats = await factory<Record<string, unknown>>("/api/stats");
    return { factoryUrl: factoryUrl(), now: new Date().toISOString(), ...stats };
  },
});
