import { guard, json } from "@/lib/api-util";
import { listKnowledge } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
  return guard("GET /api/knowledge", async () => json(await listKnowledge({ limit: 60 })));
}
