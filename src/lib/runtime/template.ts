// Resolves "{{steps.<id>.<path>}}" templates inside step params.
import type { Item } from "@/lib/blocks/types";

const TEMPLATE_RE = /\{\{\s*(steps\.[^}\s]+)\s*\}\}/g;
const EXACT_RE = /^\s*\{\{\s*(steps\.[^}\s]+)\s*\}\}\s*$/;

function lookup(ref: string, steps: Record<string, unknown>): { found: boolean; value?: unknown } {
  const parts = ref.split(".").slice(1); // drop "steps"
  let cur: unknown = steps;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return { found: false };
    const key = Array.isArray(cur) && /^\d+$/.test(part) ? Number(part) : part;
    if (!(key in (cur as object))) return { found: false };
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur === undefined ? { found: false } : { found: true, value: cur };
}

function isItem(v: unknown): v is Item {
  return !!v && typeof v === "object" && "title" in v && "url" in v;
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v) && v.length > 0 && v.every(isItem)) return v.map((i) => `- ${i.title} (${i.url})`).join("\n");
  if (v === null || v === undefined) return "";
  return JSON.stringify(v);
}

export function resolveParams(params: unknown, steps: Record<string, unknown>): { value: unknown; missing: string[] } {
  const missing: string[] = [];
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      const exact = node.match(EXACT_RE);
      if (exact) {
        const r = lookup(exact[1], steps);
        if (!r.found) {
          missing.push(exact[1]);
          return "";
        }
        return r.value;
      }
      return node.replace(TEMPLATE_RE, (_m, ref: string) => {
        const r = lookup(ref, steps);
        if (!r.found) {
          missing.push(ref);
          return "";
        }
        return stringify(r.value);
      });
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    }
    return node;
  };
  return { value: walk(params), missing };
}
