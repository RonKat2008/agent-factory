import { generateText, Output } from "ai";
import { z } from "zod";
import { callCostUsd, fastModel, isDemoMode } from "@/lib/ai";
import { cannedLlmOutput } from "@/lib/demo";
import { fail, ok, type BlockRunner } from "./types";

const MAX_INPUT_CHARS = 15_000;
const LLM_TIMEOUT_MS = 10_000;

const BulletsSchema = z.object({
  bullets: z.array(z.object({ text: z.string(), url: z.string() })),
});
const TextSchema = z.object({ text: z.string() });
const LabelsSchema = z.object({
  labels: z.array(z.object({ number: z.number(), labels: z.array(z.string()), comment: z.string() })),
});

function inputToString(input: unknown): string {
  if (typeof input === "string") return input;
  if (Array.isArray(input) && input.length > 0 && input.every((i) => i && typeof i === "object" && "title" in i)) {
    return input
      .map((i: Record<string, unknown>) => {
        const extra = [i.summary, i.body].filter((x) => typeof x === "string" && x).join(" ").slice(0, 400);
        return `- ${i.number !== undefined ? `#${i.number} ` : ""}${i.title} (${i.url})${extra ? ` :: ${extra}` : ""}`;
      })
      .join("\n");
  }
  return JSON.stringify(input, null, 1);
}

const mrkdwn = (bullets: { text: string; url: string }[]) =>
  bullets.map((b) => `• ${b.text} — <${b.url}|source>`).join("\n");

const SYSTEM = [
  "You are a precise data-processing step inside an automated agent. Follow the instruction using ONLY the provided input.",
  "Every bullet MUST cite a URL that appears verbatim in the input; never invent or alter URLs.",
  "If nothing in the input qualifies, return an empty list rather than padding.",
  "Be concise: one short sentence per bullet, no markdown inside the text.",
].join(" ");

export const llm: BlockRunner = async (params) => {
  const format = params?.format as "text" | "cited_bullets" | "issue_labels";
  const instruction = String(params?.instruction ?? "");
  if (!["text", "cited_bullets", "issue_labels"].includes(format)) return fail(`llm: unknown format "${format}"`);
  if (!instruction) return fail("llm: missing required param 'instruction'");
  const input = inputToString(params?.input).slice(0, MAX_INPUT_CHARS);

  if (isDemoMode()) return ok(cannedLlmOutput(format, input), 0);
  if (!input.trim()) {
    if (format === "cited_bullets") return ok({ bullets: [], markdown: "", empty: true }, 0);
    if (format === "issue_labels") return ok({ labels: [], markdown: "" }, 0);
    return ok({ text: "", markdown: "" }, 0);
  }

  const prompt = `Instruction: ${instruction}\n\nInput:\n${input}`;
  const common = { model: fastModel(), system: SYSTEM, prompt, abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS) } as const;
  try {
    if (format === "cited_bullets") {
      const r = await generateText({ ...common, output: Output.object({ schema: BulletsSchema }) });
      const urlsInInput = (u: string) => input.includes(u);
      const bullets = r.output.bullets.filter((b) => b.text.trim() && urlsInInput(b.url));
      return ok({ bullets, markdown: mrkdwn(bullets), empty: bullets.length === 0 }, callCostUsd(r));
    }
    if (format === "issue_labels") {
      const r = await generateText({ ...common, output: Output.object({ schema: LabelsSchema }) });
      const labels = r.output.labels;
      return ok({ labels, markdown: labels.map((l) => `• #${l.number}: ${l.labels.join(", ")}${l.comment ? ` — ${l.comment}` : ""}`).join("\n") }, callCostUsd(r));
    }
    const r = await generateText({ ...common, output: Output.object({ schema: TextSchema }) });
    return ok({ text: r.output.text, markdown: r.output.text }, callCostUsd(r));
  } catch (e) {
    return fail(`llm (${format}) call failed: ${(e as Error).message}`);
  }
};
