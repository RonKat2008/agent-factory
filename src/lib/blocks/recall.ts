import { recallKnowledge } from "@/lib/knowledge";
import { fail, ok, type BlockRunner } from "./types";

const DEFAULT_LIMIT = 5;

export const recall: BlockRunner = async (params) => {
  const q = String(params?.query ?? "").trim();
  if (!q) return fail("recall: missing required param 'query'");
  const limit = Number(params?.limit) > 0 ? Math.min(Number(params.limit), 20) : DEFAULT_LIMIT;
  try {
    const items = await recallKnowledge(q, limit);
    return ok({ items, text: items.map((i) => `${i.title} — ${i.summary}`).join("\n") });
  } catch (e) {
    return fail(`recall failed: ${(e as Error).message}`);
  }
};
