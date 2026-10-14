import { guard, json } from "@/lib/api-util";
import { listOutbox } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(): Promise<Response> {
  return guard("GET /api/outbox", async () => json({ messages: await listOutbox(30) }));
}
