import { fail, ok, type BlockRunner } from "./types";

const get = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((cur, k) => (cur && typeof cur === "object" ? (cur as Record<string, unknown>)[k] : undefined), obj);

export const filter: BlockRunner = async (params) => {
  const { input, field, op, value } = params ?? {};
  if (!Array.isArray(input)) return fail(`filter: input must be an array of items, got ${input === null ? "null" : typeof input}`);
  const items = input.filter((item) => {
    const v = get(item, String(field));
    if (op === "contains") return String(v ?? "").toLowerCase().includes(String(value).toLowerCase());
    if (op === "eq") return String(v) === String(value) || (Number(v) === Number(value) && v !== "" && v != null);
    const a = Number(v), b = Number(value);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return op === "gt" ? a > b : op === "gte" ? a >= b : op === "lt" ? a < b : op === "lte" ? a <= b : false;
  });
  return ok({ items });
};
