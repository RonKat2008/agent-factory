// Per-agent settings a non-technical owner can change: schedule (UTC cron) and their own Slack webhook.
import cronstrue from "cronstrue";
import { CronExpressionParser } from "cron-parser";
import { z } from "zod";
import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { SLACK_WEBHOOK_RE } from "@/lib/connections";
import { getActiveVersion, getAgent, insertVersion, updateAgent } from "@/lib/repo";
import { getAgentOwnership, setAgentWebhook } from "@/lib/repo-agent-settings";
import { activateVersion } from "@/lib/factory/pipeline";
import { nextRunAt } from "@/lib/runtime/schedule";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 10 * 60 * 1000;
const CRON_SAMPLES = 50;
const CRON_RE = /^\s*\S+(\s+\S+){4}\s*$/;

const BodySchema = z
  .object({
    schedule: z.string().trim().max(100).optional(),
    slackWebhook: z.string().trim().max(300).nullable().optional(),
  })
  .refine((b) => b.schedule !== undefined || b.slackWebhook !== undefined, "nothing to update");

/** Error message, or null when `cron` is a valid 5-field UTC cron that never fires more often than every 10 minutes. */
function cronProblem(cron: string): string | null {
  if (!CRON_RE.test(cron)) return "schedule must be a 5-field cron expression";
  try {
    const it = CronExpressionParser.parse(cron, { tz: "UTC" });
    let prev = it.next().toDate().getTime();
    for (let i = 0; i < CRON_SAMPLES; i++) {
      const next = it.next().toDate().getTime();
      if (next - prev < MIN_INTERVAL_MS) return "schedule can run at most every 10 minutes";
      prev = next;
    }
    return null;
  } catch {
    return "schedule is not a valid cron expression";
  }
}

function human(cron: string): string {
  try {
    return cronstrue.toString(cron);
  } catch {
    return cron;
  }
}

export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("GET /api/agents/:id/settings", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const [agent, own] = await Promise.all([getAgent(id), getAgentOwnership(id)]);
    if (!agent || !own) return jsonError("not found", 404);
    return json({ schedule: agent.schedule, hasOwnSlack: own.hasOwnSlack });
  });
}

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return guard("POST /api/agents/:id/settings", async () => {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return jsonError("invalid id", 400);
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "invalid body", 400);
    const ip = clientIp(req);
    const limited = await rateLimit("settings", { key: ip, perKey: { max: 20, windowSec: 600 }, global: { max: 200, windowSec: 3600 } });
    if (limited) return limited;

    const [agent, own] = await Promise.all([getAgent(id), getAgentOwnership(id)]);
    if (!agent || !own) return jsonError("not found", 404);
    const fresh = own.createdByIp === ip && Date.now() - new Date(own.createdAt).getTime() < EDIT_WINDOW_MS;
    if (agent.status !== "ready" && !fresh) return jsonError("Settings can only be changed before the agent is turned on", 403);

    const { schedule, slackWebhook } = parsed.data;
    if (schedule !== undefined) {
      const problem = cronProblem(schedule);
      if (problem) return jsonError(problem, 400);
    }
    if (slackWebhook && !SLACK_WEBHOOK_RE.test(slackWebhook)) {
      return jsonError("That doesn't look like a Slack webhook. It starts with https://hooks.slack.com/services/", 400);
    }

    if (slackWebhook !== undefined) await setAgentWebhook(id, slackWebhook || null);

    if (schedule !== undefined && schedule !== agent.schedule) {
      const active = await getActiveVersion(id);
      if (active) {
        const spec = { ...active.spec, schedule };
        const version = await insertVersion({
          agentId: id,
          spec,
          reason: `user edit: schedule → ${human(schedule)} (UTC)`,
          createdBy: "user",
          parentVersion: active.version,
          status: "active",
        });
        await activateVersion(id, version, spec);
      } else {
        await updateAgent(id, { schedule });
      }
      if (agent.status === "live") await updateAgent(id, { nextRunAt: nextRunAt(schedule) });
    }

    const after = await getAgentOwnership(id);
    return json({ schedule: schedule ?? agent.schedule, hasOwnSlack: after?.hasOwnSlack ?? false });
  });
}
