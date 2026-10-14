import type { NextRequest } from "next/server";
import { z } from "zod";
import { guard, json, jsonError } from "@/lib/api-util";
import { ConnectorInput, discoverMcpActions, firstIssue, invokeAction, slugify } from "@/lib/connectors";
import { limitTests } from "../shared";

export const dynamic = "force-dynamic";

const Body = z.object({
  draft: z.unknown(),
  action: z.string().max(64).optional(),
  args: z.record(z.string(), z.string().max(2000)).optional().default({}),
});

/**
 * Test an unsaved connector. HTTP: runs `action` with `args`. MCP: lists the tools (and calls `action` if given).
 * Upstream failures come back as 200 { ok:false, error } so the form can show them inline.
 */
export function POST(request: NextRequest): Promise<Response> {
  return guard("POST /api/connectors/preview", async () => {
    const body = Body.safeParse(await request.json().catch(() => null));
    if (!body.success) return jsonError(firstIssue(body.error), 400);
    const draft = ConnectorInput.safeParse(body.data.draft);
    if (!draft.success) return jsonError(firstIssue(draft.error), 400);
    const limited = await limitTests(request);
    if (limited) return limited;

    const d = draft.data;
    const secret = d.secret.trim() || null;
    const slug = slugify(d.name);
    if (d.kind === "mcp") {
      const found = await discoverMcpActions(d.baseUrl, secret);
      if (!found.ok) return json({ ok: false, error: found.error });
      if (!body.data.action) return json({ ok: true, actions: found.actions, total: found.total });
      const r = await invokeAction({ slug, kind: "mcp", baseUrl: d.baseUrl, authHeader: null, actions: found.actions }, body.data.action, body.data.args, secret);
      return json(r.ok ? { ok: true, actions: found.actions, total: found.total, result: r.output } : { ok: false, actions: found.actions, error: r.error });
    }
    const action = body.data.action ?? d.actions[0]?.name ?? "";
    const r = await invokeAction({ slug, kind: "http", baseUrl: d.baseUrl, authHeader: d.authHeader || null, actions: d.actions }, action, body.data.args, secret);
    return json(r.ok ? { ok: true, result: r.output } : { ok: false, error: r.error });
  });
}
