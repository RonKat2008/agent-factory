import type { NextRequest } from "next/server";
import { z } from "zod";
import { guard, json, jsonError } from "@/lib/api-util";
import { firstIssue, invokeConnector } from "@/lib/connectors";
import { getCustomConnector } from "@/lib/repo-connectors";
import { limitTests } from "../../shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

const Body = z.object({
  action: z.string().min(1).max(64),
  args: z.record(z.string(), z.string().max(2000)).optional().default({}),
});

/** Run one action of a saved connector; upstream failures come back as 200 { ok:false, error }. */
export function POST(request: NextRequest, { params }: Ctx): Promise<Response> {
  return guard("POST /api/connectors/:slug/test", async () => {
    const { slug } = await params;
    const body = Body.safeParse(await request.json().catch(() => null));
    if (!body.success) return jsonError(firstIssue(body.error), 400);
    if (!(await getCustomConnector(slug))) return jsonError("connector not found", 404);
    const limited = await limitTests(request);
    if (limited) return limited;
    const r = await invokeConnector(slug, body.data.action, body.data.args);
    return json(r.ok ? { ok: true, result: r.output } : { ok: false, error: r.error });
  });
}
