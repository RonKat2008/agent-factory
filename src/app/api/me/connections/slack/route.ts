// DELETE /api/me/connections/slack → forget this visitor's Slack channel (signed-in user and anonymous id).
import { guard, json } from "@/lib/api-util";
import { deleteVisitorSlack } from "@/lib/repo-visitor";
import { getOwnerIds } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export function DELETE(): Promise<Response> {
  return guard("DELETE /api/me/connections/slack", async () => {
    for (const id of await getOwnerIds()) await deleteVisitorSlack(id);
    return json({ slack: null });
  });
}
