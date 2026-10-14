import { fail, ok, type BlockRunner, type Item } from "./types";

const MIN_ENTRY_CHARS = 15;
const MAX_CHANGES = 10;

const MAX_SUMMARY_CHARS = 400;

/** "title (url)", plus the summary when it adds information (release notes, feed blurbs) so later steps can use it. */
function itemLine(i: Item): string {
  const base = `${i.title} (${i.url})`;
  const summary = i.summary?.trim();
  return summary && summary !== i.title ? `${base}: ${summary.slice(0, MAX_SUMMARY_CHARS)}` : base;
}

function normalize(input: unknown): string[] | null {
  if (typeof input === "string") {
    return input.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= MIN_ENTRY_CHARS);
  }
  if (Array.isArray(input)) {
    return input.map((i) => (typeof i === "string" ? i : itemLine(i as Item))).filter(Boolean);
  }
  return null;
}

export const diffWithMemory: BlockRunner = async (params, ctx) => {
  const key = String(params?.memoryKey ?? "");
  if (!key) return fail("diff_with_memory: missing required param 'memoryKey'");
  const entries = normalize(params?.input);
  if (!entries) return fail("diff_with_memory: input must be a string or an array of items");
  const prevRaw = await ctx.memoryGet(key);
  const prev = Array.isArray(prevRaw) ? (prevRaw as string[]) : undefined;
  const seen = new Set(prev ?? []);
  const changes = entries.filter((e) => !seen.has(e)).slice(0, MAX_CHANGES);
  if (!ctx.dryRun) await ctx.memorySet(key, entries);
  return ok({ changes, changed: changes.length > 0, firstRun: prev === undefined, text: changes.join("\n") });
};
