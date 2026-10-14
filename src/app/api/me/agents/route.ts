// GET /api/me/agents → { agentIds } owned by the signed-in user or this browser's anonymous id.
import { guard, json } from "@/lib/api-util";
import { listOwnedAgentIds } from "@/lib/repo-visitor";
import { getOwnerIds } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
  return guard("GET /api/me/agents", async () => json({ agentIds: await listOwnedAgentIds(await getOwnerIds()) }));
}
