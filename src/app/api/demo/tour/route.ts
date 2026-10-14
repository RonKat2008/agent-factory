import { guard, json, jsonError } from "@/lib/api-util";
import { getAcmeState } from "@/lib/demo-acme";
import { breakAcme, findWatcher, publishAcme, resetDemo } from "@/lib/demo-actions";
import { demoGet, demoSet } from "@/lib/repo";
import { blockBots } from "@/lib/bot-guard";
import { startAgentRun } from "@/lib/runtime/start-run";

export const dynamic = "force-dynamic";

// PUBLIC: judges use this without the admin key, so break/publish are rate limited.
const TOUR_KEY = "tour";
const LIMIT_MS = { break: 60_000, publish: 20_000, reset: 10_000 } as const;
type Guarded = keyof typeof LIMIT_MS;
type TourState = { lastBreakAt?: number; lastPublishAt?: number; lastResetAt?: number };

async function readTour(): Promise<TourState> {
  const raw = (await demoGet(TOUR_KEY)) as TourState | null;
  return {
    lastBreakAt: typeof raw?.lastBreakAt === "number" ? raw.lastBreakAt : undefined,
    lastPublishAt: typeof raw?.lastPublishAt === "number" ? raw.lastPublishAt : undefined,
    lastResetAt: typeof raw?.lastResetAt === "number" ? raw.lastResetAt : undefined,
  };
}

/** Returns seconds to wait, or 0 if allowed (and records this attempt). */
async function claim(action: Guarded): Promise<number> {
  const state = await readTour();
  const field = action === "break" ? "lastBreakAt" : action === "reset" ? "lastResetAt" : "lastPublishAt";
  const now = Date.now();
  const wait = (state[field] ?? 0) + LIMIT_MS[action] - now;
  if (wait > 0) return Math.ceil(wait / 1000);
  await demoSet(TOUR_KEY, { ...state, [field]: now });
  return 0;
}

export function GET(): Promise<Response> {
  return guard("GET /api/demo/tour", async () => {
    const [acme, watcher] = await Promise.all([getAcmeState(), findWatcher()]);
    return json({ acme: { broken: acme.broken, published: acme.published }, watcher });
  });
}

export function POST(request: Request): Promise<Response> {
  return guard("POST /api/demo/tour", async () => {
    const bot = await blockBots();
    if (bot) return bot;
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const action = body.action;
    if (action !== "break" && action !== "publish" && action !== "reset") return jsonError("invalid action", 400);

    if (action === "reset") {
      const retryIn = await claim("reset");
      if (retryIn > 0) {
        return Response.json({ error: `Reset just ran, try again in ${retryIn}s`, retryInSec: retryIn }, { status: 429, headers: { "Cache-Control": "no-store" } });
      }
      return json(await resetDemo());
    }

    const retryInSec = await claim(action);
    if (retryInSec > 0) {
      return Response.json(
        { error: `Someone just did this, try again in ${retryInSec}s`, retryInSec },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (action === "publish") return json(await publishAcme());

    const startedAt = new Date().toISOString();
    const result = await breakAcme();
    const watcher = await findWatcher();
    let runId: string | null = null;
    if (watcher && watcher.status !== "building" && watcher.status !== "testing") {
      runId = await startAgentRun(watcher.id, "manual");
    }
    return json({ ...result, watcherId: watcher?.id ?? null, runId, startedAt });
  });
}
