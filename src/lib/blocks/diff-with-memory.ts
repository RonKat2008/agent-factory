import { fail, ok, type BlockRunner, type Item } from "./types";

const MIN_ENTRY_CHARS = 15;
const MAX_CHANGES = 10;

function normalize(input: unknown): string[] | null {
  if (typeof input === "string") {
    return input.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= MIN_ENTRY_CHARS);
  }
  if (Array.isArray(input)) {
    return input.map((i) => (typeof i === "string" ? i : `${(i as Item).title} (${(i as Item).url})`)).filter(Boolean);
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
