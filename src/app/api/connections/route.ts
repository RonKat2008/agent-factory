import { guard, json } from "@/lib/api-util";
import { listConnections } from "@/lib/connections";

/** Public, read-only: { connections: [{ provider, connected, meta, via, updatedAt }] }. Never includes secrets. */
export function GET() {
  return guard("connections.list", async () => json({ connections: await listConnections() }));
}
