import { guard, json } from "@/lib/api-util";
import { listAgents } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
  return guard("GET /api/agents", async () => json({ agents: await listAgents() }));
}

// POST: Task 5
