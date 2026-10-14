import type { AgentSpec, RunOutput } from "@/lib/spec";

export type StepResultLite = { ok: boolean; output?: unknown; resolvedParams?: unknown };

const BULLET_RE = /^\s*(?:[•\-*]|\d+[.)])\s+/;
const SLACK_LINK_RE = /<(https?:\/\/[^|>\s]+)(?:\|([^>]*))?>/;
const PLAIN_URL_RE = /https?:\/\/[^\s)>\]|]+/;

export const isBulletLine = (line: string) => BULLET_RE.test(line);

/** Extracts the first URL in a line (Slack `<url|label>`, markdown `[t](url)`, or bare). */
export function urlInLine(line: string): string | null {
  const slack = line.match(SLACK_LINK_RE);
  if (slack) return slack[1];
  const md = line.match(/\]\((https?:\/\/[^)\s]+)\)/);
  if (md) return md[1];
  return line.match(PLAIN_URL_RE)?.[0] ?? null;
}

export function extractCitations(message: string): { text: string; url: string }[] {
  const out: { text: string; url: string }[] = [];
  for (const line of message.split("\n")) {
    if (!isBulletLine(line)) continue;
    const url = urlInLine(line);
    if (!url) continue;
    const text = line
      .replace(BULLET_RE, "")
      .replace(/<https?:\/\/[^>]*>/g, "")
      .replace(/\[([^\]]*)\]\(https?:\/\/[^)]*\)/g, "$1")
      .replace(PLAIN_URL_RE, "")
      .replace(/\s*[—–-]\s*$/, "")
      .trim();
    out.push({ text, url });
  }
  return out;
}

export function deriveRunOutput(spec: AgentSpec, results: Record<string, StepResultLite>): RunOutput {
  const sendStep = [...spec.steps].reverse().find((s) => s.block === "send_slack");
  const llmStep = [...spec.steps].reverse().find((s) => s.block === "llm" && results[s.id]?.ok);

  let message = "";
  if (sendStep) {
    const p = results[sendStep.id]?.resolvedParams as { message?: unknown } | undefined;
    message = typeof p?.message === "string" ? p.message : "";
  } else if (llmStep) {
    const o = results[llmStep.id]?.output as { markdown?: unknown } | undefined;
    message = typeof o?.markdown === "string" ? o.markdown : "";
  }

  const sendOut = sendStep ? (results[sendStep.id]?.output as { sent?: boolean } | undefined) : undefined;
  const diffStep = spec.steps.find((s) => s.block === "diff_with_memory");
  const diffOut = diffStep ? (results[diffStep.id]?.output as { changed?: boolean } | undefined) : undefined;

  return {
    message,
    citations: extractCitations(message),
    posted: sendOut?.sent === true,
    changed: typeof diffOut?.changed === "boolean" ? diffOut.changed : null,
  };
}
