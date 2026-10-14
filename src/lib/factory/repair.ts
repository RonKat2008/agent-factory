// Self-repair brain: diagnose a failed run and propose a minimal patch to the agent spec,
// plus a regression test that encodes the failure. LLM first (MODEL_SMART), with a
// deterministic fallback for the common "source page moved" failure.
import { generateText, Output } from "ai";
import { z } from "zod";
import { callCostUsd, isDemoMode, smartModel } from "@/lib/ai";
import { BLOCKS } from "@/lib/blocks";
import { AgentSpecSchema, type AgentSpec, type AgentTest } from "@/lib/spec";
import type { Run } from "@/lib/types";
import type { LinkCandidate } from "./link-candidates";

const LLM_TIMEOUT_MS = 20_000;
const PREVIEW_CHARS = 600;

export type FailingStep = { stepId: string; block: string; error: string; input: unknown };

export type RepairInput = {
  spec: AgentSpec;
  failingRun: Run;
  lastGoodRun: Run | null;
  candidates: LinkCandidate[];
  /** Details of a previous patch that failed its dry run (second attempt). */
  previousAttempt?: { diagnosis: string; failure: string } | null;
};

export type RepairPatch = {
  diagnosis: string;
  spec: AgentSpec;
  regressionTest: AgentTest;
  costUsd: number;
  method: "llm" | "fallback";
};

// ---------- helpers ----------

export function failingStepOf(run: Run): FailingStep | null {
  const s = run.steps?.find((x) => x.status === "error");
  return s ? { stepId: s.stepId, block: s.block, error: s.error ?? "unknown error", input: s.input } : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function preview(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (!s) return "";
  return s.length > PREVIEW_CHARS ? `${s.slice(0, PREVIEW_CHARS)}…` : s;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function httpStatusOf(error: string): string | null {
  return error.match(/HTTP (\d{3})/)?.[1] ?? null;
}

/** Appends the regression test unless an equivalent one (same kind + stepId) already exists. */
export function withRegressionTest(spec: AgentSpec, test: AgentTest): AgentSpec {
  const dup = spec.tests.some((t) => t.kind === test.kind && (t.config?.stepId ?? null) === (test.config?.stepId ?? null));
  return dup ? spec : { ...spec, tests: [...spec.tests, { ...test, addedBy: "repair" }] };
}

function stepSucceedsTest(stepId: string, what: string): AgentTest {
  return { kind: "step_succeeds", config: { stepId }, addedBy: "repair", note: `Regression: ${what} on ${today()}` };
}

function whatBroke(failing: FailingStep | null, run: Run): string {
  if (failing) {
    const url = (failing.input as { url?: unknown } | null)?.url;
    const status = httpStatusOf(failing.error);
    if (failing.block === "fetch_url" && typeof url === "string") {
      return `${pathOf(url)} returned ${status ?? "an error"}`;
    }
    return `step "${failing.stepId}" (${failing.block}) failed: ${failing.error.slice(0, 120)}`;
  }
  const failed = run.tests?.filter((t) => !t.passed) ?? [];
  return failed.length > 0 ? `test ${failed[0].kind} failed` : "run failed";
}

// ---------- deterministic fallback ----------

/** URL swap for a fetch_url failure using the top verified candidate. Null when not applicable. */
export function deterministicPatch(input: RepairInput): RepairPatch | null {
  const failing = failingStepOf(input.failingRun);
  const top = input.candidates[0];
  if (!failing || failing.block !== "fetch_url" || !top) return null;
  const steps = input.spec.steps.map((s) =>
    s.id === failing.stepId && s.block === "fetch_url" ? { ...s, params: { ...s.params, url: top.url } } : s,
  );
  const status = httpStatusOf(failing.error) ?? "an error";
  const regressionTest = stepSucceedsTest(failing.stepId, whatBroke(failing, input.failingRun));
  const spec = withRegressionTest({ ...input.spec, steps }, regressionTest);
  return {
    diagnosis: `the source page moved to ${pathOf(top.url)} (old URL returned ${status})`,
    spec,
    regressionTest,
    costUsd: 0,
    method: "fallback",
  };
}

// ---------- LLM patch ----------

const PatchSchema = z.object({
  diagnosis: z
    .string()
    .describe('One plain-English clause, no trailing period, starting lowercase (keep proper nouns capitalized), e.g. "the changelog moved to /demo/acme/updates (old URL 404)"'),
  changes: z
    .array(
      z.object({
        stepId: z.string(),
        param: z.string().describe("Name of the param to change"),
        value: z.string().describe("New value (numbers as digits)"),
      }),
    )
    .describe("Minimal param changes. Empty if no safe fix exists."),
  regressionTest: z.object({
    kind: z.enum(["nonempty", "has_citations", "max_items", "llm_judge", "no_post_if_unchanged", "step_succeeds"]),
    stepId: z.string().optional(),
    rubric: z.string().optional(),
    max: z.number().int().optional(),
  }),
});

const SYSTEM = [
  "You repair broken automated agents. An agent is a JSON spec of blocks executed in order; templates like {{steps.<id>.<field>}} pass data between steps.",
  "Produce the MINIMAL patch as param changes on existing steps. Never add, remove or reorder steps. Never remove tests.",
  "If a source URL is dead, prefer a VERIFIED candidate URL from the list over any guess; never invent URLs.",
  "The regression test must encode the failure: for a source/step failure use kind step_succeeds with the failing stepId.",
  'The diagnosis is one short sentence saying what changed and why it broke, e.g. "the changelog moved to /demo/acme/updates (old URL 404)".',
].join(" ");

function buildPrompt(input: RepairInput, failing: FailingStep | null): string {
  const run = input.failingRun;
  const failedTests = (run.tests ?? []).filter((t) => !t.passed).map((t) => `- ${t.kind}: ${t.detail}`).join("\n") || "(none)";
  const stepLines = (run.steps ?? [])
    .map((s) => `- ${s.stepId} (${s.block}) ${s.status}${s.error ? ` ERROR: ${s.error}` : ""}\n  input: ${preview(s.input)}\n  output: ${preview(s.output)}`)
    .join("\n");
  const goodLines = input.lastGoodRun?.steps?.map((s) => `- ${s.stepId} (${s.block}) ${s.status}: ${preview(s.output)}`).join("\n") ?? "(no earlier successful run)";
  const cands = input.candidates.length
    ? input.candidates.map((c) => `- ${c.url} (link text "${c.text}", HTTP ${c.status}, ${c.textLength} chars of text, score ${c.score})`).join("\n")
    : "(none found)";
  const blocks = Object.entries(BLOCKS).map(([name, b]) => `- ${name}: params ${b.params}`).join("\n");
  return [
    `Agent spec:\n${JSON.stringify(input.spec, null, 1)}`,
    `Blocks:\n${blocks}`,
    `Failing run error: ${run.error ?? "(none)"}`,
    failing ? `Failing step: ${failing.stepId} (${failing.block}): ${failing.error}` : "No step errored; tests failed.",
    `Failing run steps:\n${stepLines}`,
    `Failed tests:\n${failedTests}`,
    `Last good run (step output previews):\n${goodLines}`,
    `Verified candidate replacement pages on the same site:\n${cands}`,
    input.previousAttempt
      ? `A previous patch ("${input.previousAttempt.diagnosis}") FAILED its dry run: ${input.previousAttempt.failure}. Propose something different.`
      : "",
    "Return the diagnosis, the param changes and the regression test.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function applyChanges(spec: AgentSpec, changes: z.infer<typeof PatchSchema>["changes"]): AgentSpec {
  const steps = spec.steps.map((s) => {
    const mine = changes.filter((c) => c.stepId === s.id);
    if (mine.length === 0) return s;
    const params: Record<string, unknown> = { ...s.params };
    for (const c of mine) {
      const prev = params[c.param];
      params[c.param] = typeof prev === "number" ? Number(c.value) : typeof prev === "boolean" ? c.value === "true" : c.value;
    }
    return { ...s, params };
  });
  return AgentSpecSchema.parse({ ...spec, steps });
}

function toRegressionTest(r: z.infer<typeof PatchSchema>["regressionTest"], failing: FailingStep | null, what: string): AgentTest {
  if (failing) return stepSucceedsTest(failing.stepId, what);
  const config: AgentTest["config"] = {};
  if (r.stepId) config.stepId = r.stepId;
  if (r.rubric) config.rubric = r.rubric;
  if (r.max !== undefined) config.max = r.max;
  return { kind: r.kind, config, addedBy: "repair", note: `Regression: ${what} on ${today()}` };
}

async function llmPatch(input: RepairInput): Promise<RepairPatch> {
  const failing = failingStepOf(input.failingRun);
  const r = await generateText({
    model: smartModel(),
    system: SYSTEM,
    prompt: buildPrompt(input, failing),
    output: Output.object({ schema: PatchSchema }),
    abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  const out = r.output;
  if (out.changes.length === 0) throw new Error(`no patch proposed: ${out.diagnosis}`);
  const patched = applyChanges(input.spec, out.changes);
  const regressionTest = toRegressionTest(out.regressionTest, failing, whatBroke(failing, input.failingRun));
  return {
    diagnosis: out.diagnosis.trim().replace(/\.$/, ""),
    spec: withRegressionTest(patched, regressionTest),
    regressionTest,
    costUsd: callCostUsd(r),
    method: "llm",
  };
}

/**
 * Diagnose + patch. DEMO_MODE or `preferFallback` → deterministic fallback first.
 * LLM error → deterministic fallback. Null when neither path can produce a patch.
 */
export async function diagnoseAndPatch(input: RepairInput & { preferFallback?: boolean }): Promise<RepairPatch | null> {
  if (isDemoMode() || input.preferFallback) {
    const fb = deterministicPatch(input);
    if (fb || isDemoMode()) return fb;
  }
  try {
    return await llmPatch(input);
  } catch (e) {
    console.error("[repair] LLM patch failed, using fallback:", (e as Error).message);
    return deterministicPatch(input);
  }
}
