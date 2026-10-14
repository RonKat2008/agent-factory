import { guard, json } from "@/lib/api-util";
import { getStats } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
  return guard("GET /api/stats", async () => json(await getStats()));
}
