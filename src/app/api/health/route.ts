import { getHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getHealth());
}
