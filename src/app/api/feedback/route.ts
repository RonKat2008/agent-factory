import { z } from "zod";
import { UUID_RE, guard, json, jsonError } from "@/lib/api-util";
import { attachFeedbackComment, insertFeedback, logEvent } from "@/lib/repo";

export const dynamic = "force-dynamic";

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
    // The /f/:runId link already recorded the rating; a follow-up comment attaches to that row.
    const attached = text ? await attachFeedbackComment({ runId, rating, comment: text }) : null;
    const r = attached ?? (await insertFeedback({ runId, rating, comment: text }));
    if (!r) return jsonError("run not found", 404);
    await logEvent(r.agentId, "feedback", text ? `👎 "${text.slice(0, 140)}"` : rating === "useful" ? "👍 Useful" : "👎 Not useful", { runId, rating, comment: text });
    return json({ ok: true });
  });
}
