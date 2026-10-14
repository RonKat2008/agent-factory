import { after } from "next/server";
import { z } from "zod";
import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { proposeFromFeedback } from "@/lib/factory/feedback-edit";
import { attachFeedbackComment, insertFeedback, logEvent } from "@/lib/repo";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  runId: z.string().regex(UUID_RE),
  rating: z.enum(["useful", "not_useful"]),
  comment: z.string().max(2000).optional(),
});

export function POST(req: Request): Promise<Response> {
  return guard("POST /api/feedback", async () => {
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return jsonError("body must be { runId, rating: 'useful'|'not_useful', comment? }", 400);
    const { runId, rating, comment } = body.data;
    const text = comment?.trim() || null;
    if (rating === "not_useful" && text) {
      const limited = await rateLimit("feedback", { key: clientIp(req), perKey: { max: 5, windowSec: 600 }, global: { max: 20, windowSec: 3600 } });
      if (limited) return limited;
    }
    // The /f/:runId link already recorded the rating; a follow-up comment attaches to that row.
    const attached = text ? await attachFeedbackComment({ runId, rating, comment: text }) : null;
    const r = attached ?? (await insertFeedback({ runId, rating, comment: text }));
    if (!r) return jsonError("run not found", 404);
    await logEvent(r.agentId, "feedback", text ? `👎 "${text.slice(0, 140)}"` : rating === "useful" ? "👍 Useful" : "👎 Not useful", { runId, rating, comment: text });
    if (rating === "not_useful" && text) after(() => proposeFromFeedback(r.agentId, text));
    return json({ ok: true });
  });
}
