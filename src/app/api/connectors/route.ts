import type { NextRequest } from "next/server";
import { guard, json, jsonError } from "@/lib/api-util";
import { blockBots } from "@/lib/bot-guard";
import { encryptSecret } from "@/lib/crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ConnectorInput, MAX_CONNECTORS, discoverMcpActions, firstIssue, slugify } from "@/lib/connectors";
import { countCustomConnectors, getCustomConnector, insertCustomConnector, listCustomConnectors, slugTaken, type ConnectorAction } from "@/lib/repo-connectors";
import { toPublic } from "./shared";

export const dynamic = "force-dynamic";

const RESERVED = new Set(["preview"]);

/** List community connectors (no secrets). */
export function GET(request: NextRequest): Promise<Response> {
  return guard("GET /api/connectors", async () => {
    const list = await listCustomConnectors();
    return json({ connectors: list.map((c) => toPublic(request, c)), max: MAX_CONNECTORS });
  });
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 1; i < 20; i++) {
    const candidate = i === 1 ? base : `${base.slice(0, 29)}_${i}`;
    if (!RESERVED.has(candidate) && !(await slugTaken(candidate))) return candidate;
  }
  return `${base.slice(0, 26)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a connector. Anyone may add one: validated, SSRF-guarded, rate-limited, capped at MAX_CONNECTORS. */
export function POST(request: NextRequest): Promise<Response> {
  return guard("POST /api/connectors", async () => {
    const bot = await blockBots();
    if (bot) return bot;
    const parsed = ConnectorInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const input = parsed.data;
    const limited = await rateLimit("connector", { key: clientIp(request), perKey: { max: 3, windowSec: 600 }, global: { max: 30, windowSec: 3600 } });
    if (limited) return limited;
    if ((await countCustomConnectors()) >= MAX_CONNECTORS) return jsonError(`Pitcrew already has ${MAX_CONNECTORS} community connectors; ask an admin to remove one`, 409);

    const secret = input.secret.trim() || null;
    let actions: ConnectorAction[] = input.kind === "http" ? input.actions : [];
    if (input.kind === "mcp") {
      const found = await discoverMcpActions(input.baseUrl, secret);
      if (!found.ok) return jsonError(`Couldn't list the MCP server's tools: ${found.error}`, 400);
      actions = found.actions;
    }

    const created = await insertCustomConnector({
      slug: await uniqueSlug(input.name),
      kind: input.kind,
      name: input.name,
      baseUrl: input.baseUrl,
      authHeader: input.kind === "http" ? input.authHeader || null : secret ? "Authorization" : null,
      secretEnc: secret ? encryptSecret(secret) : null,
      actions,
      createdByIp: clientIp(request),
    });
    const full = await getCustomConnector(created.slug);
    return Response.json({ connector: full ? toPublic(request, full) : { ...created, canDelete: true } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
