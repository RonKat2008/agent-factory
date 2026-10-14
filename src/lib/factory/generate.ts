// LLM side of the builder: text -> spec, spec + failures -> revised spec, spec + instruction -> edited spec.
import { generateText, Output } from "ai";
import { z } from "zod";
import { callCostUsd, isDemoMode, smartModel } from "@/lib/ai";
import { blockCatalog } from "@/lib/blocks";
import { connectorCatalog } from "@/lib/connectors";
import { cannedBuildSpec, cannedEditResult, cannedReviseResult } from "@/lib/demo";
import { AgentSpecSchema, type AgentSpec } from "@/lib/spec";

const GENERATE_TIMEOUT_MS = 90_000;
const MAX_SUMMARY_CHARS = 4_000;

export type GenerateResult = { spec: AgentSpec; costUsd: number };
export type ReviseResult = { spec: AgentSpec; changeSummary: string; costUsd: number };

const ChangeSchema = z.object({
  spec: AgentSpecSchema,
  changeSummary: z.string().describe("One short plain-English sentence describing what changed, e.g. 'Cite the source URL on every bullet'"),
});

const EXAMPLE_DIGEST = {
  name: "Daily AI agents digest",
  schedule: "0 16 * * 1-5",
  steps: [
    { id: "hn", block: "hn_search", params: { query: "AI agents", minPoints: 20, sinceHours: 24, limit: 15 } },
    {
      id: "top",
      block: "llm",
      params: {
        instruction: "Pick the 3 most important items about AI agents. One bullet each, cite the item URL.",
        input: "{{steps.hn.items}}",
        format: "cited_bullets",
      },
    },
    { id: "post", block: "send_slack", params: { message: "*AI agents digest*\n{{steps.top.markdown}}", skipIfEmpty: true } },
  ],
  tests: [
    { kind: "nonempty", addedBy: "build" },
    { kind: "has_citations", addedBy: "build" },
    { kind: "max_items", config: { max: 3 }, addedBy: "build" },
    { kind: "llm_judge", config: { rubric: "Exactly 3 bullets, each about AI agents, each with a source URL." }, addedBy: "build" },
  ],
  requiresApproval: false,
  plan: {
    runs: "Every weekday at 9:00 AM Pacific",
    checks: "Hacker News stories about AI agents from the last day",
    does: "Picks the 3 most important and summarizes each with a link",
    sendsTo: "Slack",
    asksBefore: "Nothing",
  },
};

const EXAMPLE_WATCHER = {
  name: "Acme pricing watcher",
  schedule: "0 * * * *",
  steps: [
    { id: "page", block: "fetch_url", params: { url: "https://acme.example/pricing" } },
    { id: "diff", block: "diff_with_memory", params: { input: "{{steps.page.text}}", memoryKey: "acme_pricing" } },
    {
      id: "summary",
      block: "llm",
      params: {
        instruction: "Summarize each change in one bullet. Cite the page URL given as Source. If there are no changes return an empty list.",
        input: "Source: {{steps.page.url}}\nChanges:\n{{steps.diff.text}}",
        format: "cited_bullets",
      },
    },
    { id: "post", block: "send_slack", params: { message: "*Acme changed something*\n{{steps.summary.markdown}}", skipIfEmpty: true } },
  ],
  tests: [
    { kind: "has_citations", addedBy: "build" },
    { kind: "no_post_if_unchanged", addedBy: "build" },
    { kind: "llm_judge", config: { rubric: "Only mentions changes present in the source; under 120 words." }, addedBy: "build" },
  ],
  requiresApproval: false,
  plan: {
    runs: "Every hour",
    checks: "The Acme pricing page",
    does: "Detects what changed since last time and summarizes it with a link",
    sendsTo: "Slack",
    asksBefore: "Nothing",
  },
};

function systemPrompt(): string {
  return [
    "You design scheduled AI agents as JSON specs made ONLY of the blocks in the catalog below. You never write code.",
    "",
    blockCatalog(),
    "",
    "Rules:",
    "- Reference earlier outputs with {{steps.<id>.<field>}} using the EXACT output field names from the catalog. Step ids are short snake_case and unique.",
    "- schedule is a 5-field cron in UTC. The user is in America/Los_Angeles (UTC-7 in summer): convert local times, e.g. 9am daily -> '0 16 * * *', weekdays -> '0 16 * * 1-5'.",
    "- Default to delivering via send_slack with skipIfEmpty: true as the last step.",
    "- Use llm with format 'cited_bullets' whenever the output summarizes sources, and tell it how many bullets are wanted.",
    "- ALWAYS write 2-4 meaningful tests: has_citations when citing, max_items (config.max) when a count is requested, no_post_if_unchanged when diff_with_memory is used, plus one llm_judge with a concrete rubric derived from the request. Set addedBy to 'build'.",
    "- llm_judge rubrics are graded by a model that sees ONLY the final message text. They must be checkable from that text alone (count, topic, format, tone, length). Never require facts the message cannot show (e.g. point counts, timestamps); enforce those with deterministic steps like filter instead.",
    "- Set requiresApproval true only if the user asks to approve/review before posting.",
    "- plan is a 5-line plain-English card (runs, checks, does, sendsTo, asksBefore). asksBefore is 'Nothing' unless approval is required.",
    "- Never invent URLs. For 'watch X' requests use the real URL of the page if you know it, otherwise fetch_url on the site homepage.",
    "- name is a short human title (2-5 words).",
    "- Dry runs hit live data and tests like nonempty fail on an empty result. When a change narrows results (e.g. a points/keyword filter), also widen the source window (e.g. hn_search sinceHours 168, higher limit) so enough items survive, and make LLM instructions robust to fewer items. The llm block only sees each item's title, url and short summary, never fields like points: do not ask it to state such fields.",
    "",
    "Example 1 (digest):",
    JSON.stringify(EXAMPLE_DIGEST),
    "",
    "Example 2 (watcher using diff_with_memory):",
    JSON.stringify(EXAMPLE_WATCHER),
  ].join("\n");
}

async function structured<T extends z.ZodType>(schema: T, prompt: string): Promise<{ output: z.infer<T>; costUsd: number }> {
  const connectors = await connectorCatalog();
  const result = await generateText({
    model: smartModel(),
    system: connectors ? `${systemPrompt()}\n\n${connectors}` : systemPrompt(),
    prompt,
    output: Output.object({ schema }),
    abortSignal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
  });
  return { output: result.output as z.infer<T>, costUsd: callCostUsd(result) };
}

export async function generateSpec(request: string): Promise<GenerateResult> {
  if (isDemoMode()) return { spec: cannedBuildSpec(request), costUsd: 0 };
  const { output, costUsd } = await structured(AgentSpecSchema, `Design an agent for this request:\n\n${request}`);
  return { spec: AgentSpecSchema.parse(output), costUsd };
}

export async function reviseSpec(spec: AgentSpec, failures: string[], stepSummaries: string): Promise<ReviseResult> {
  if (isDemoMode()) return cannedReviseResult(spec);
  const prompt = [
    "This agent spec failed its dry run. Fix the spec with the smallest change that makes the failing tests pass. Do not weaken or delete tests to make them pass; fix the steps/instructions instead (you may adjust an incorrect test).",
    "",
    "Current spec:",
    JSON.stringify(spec),
    "",
    "Failures:",
    ...failures.map((f) => `- ${f}`),
    "",
    "Per-step output previews from the dry run:",
    stepSummaries.slice(0, MAX_SUMMARY_CHARS),
  ].join("\n");
  const { output, costUsd } = await structured(ChangeSchema, prompt);
  return { spec: AgentSpecSchema.parse(output.spec), changeSummary: output.changeSummary, costUsd };
}

export async function editSpec(spec: AgentSpec, instruction: string): Promise<ReviseResult> {
  if (isDemoMode()) return cannedEditResult(spec, instruction);
  const prompt = [
    "Apply this change request to the agent spec with the MINIMAL change that satisfies it. Keep step ids and existing tests unless the instruction requires otherwise. You may add a test that encodes the instruction (e.g. a filter request -> an llm_judge test with a concrete rubric). Keep the plan card accurate.",
    "",
    `Instruction: ${instruction}`,
    "",
    "Current spec:",
    JSON.stringify(spec),
  ].join("\n");
  const { output, costUsd } = await structured(ChangeSchema, prompt);
  return { spec: AgentSpecSchema.parse(output.spec), changeSummary: output.changeSummary, costUsd };
}
