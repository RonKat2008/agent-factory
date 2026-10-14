// Resolves "{{steps.<id>.<path>}}" and "{{trigger.<field>}}" templates inside step params.
import type { Item } from "@/lib/blocks/types";

/** What a chained (triggered) run knows about the upstream post that fired it. JSON-serializable. */
export type TriggerContext = {
  agentId: string; // upstream agent
  agentName: string;
  runId: string | null; // upstream run that posted (null for a sample context)
  message: string; // the upstream post
  citations: { text: string; url: string }[];
  depth: number; // hops from the original (non-triggered) run: 1 for a direct trigger, 0 for a sample
  sample?: boolean; // true when this is the upstream's last post used for a dry/manual/scheduled run
};

const TEMPLATE_RE = /\{\{\s*((?:steps|trigger)\.[^}\s]+)\s*\}\}/g;
const EXACT_RE = /^\s*\{\{\s*((?:steps|trigger)\.[^}\s]+)\s*\}\}\s*$/;

function lookup(ref: string, steps: Record<string, unknown>, trigger?: TriggerContext): { found: boolean; value?: unknown } {
  const [root, ...parts] = ref.split(".");
  let cur: unknown = root === "trigger" ? trigger : steps;
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

function isCitation(v: unknown): v is { text: string; url: string } {
  return !!v && typeof v === "object" && "text" in v && "url" in v;
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v) && v.length > 0 && v.every(isItem)) return v.map((i) => `- ${i.title} (${i.url})`).join("\n");
  if (Array.isArray(v) && v.length > 0 && v.every(isCitation)) return v.map((c) => `- ${c.text} (${c.url})`).join("\n");
  if (v === null || v === undefined) return "";
  return JSON.stringify(v);
}

export function resolveParams(
  params: unknown,
  steps: Record<string, unknown>,
  trigger?: TriggerContext,
): { value: unknown; missing: string[] } {
  const missing: string[] = [];
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      const exact = node.match(EXACT_RE);
      if (exact) {
        const r = lookup(exact[1], steps, trigger);
        if (!r.found) {
          missing.push(exact[1]);
          return "";
        }
        return r.value;
      }
      return node.replace(TEMPLATE_RE, (_m, ref: string) => {
        const r = lookup(ref, steps, trigger);
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
