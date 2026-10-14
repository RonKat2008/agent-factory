import { generateText, Output } from "ai";
import { z } from "zod";
import { callCostUsd, fastModel, isDemoMode } from "@/lib/ai";
import { CANNED_JUDGE_RESULT } from "@/lib/demo";
import type { AgentSpec, AgentTest, RunOutput } from "@/lib/spec";
import { isBulletLine, urlInLine, type StepResultLite } from "./output";

export type TestResult = { testIndex: number; kind: AgentTest["kind"]; passed: boolean; detail: string; costUsd: number };

const JUDGE_TIMEOUT_MS = 8_000;
const bulletsOf = (message: string) => message.split("\n").filter(isBulletLine);
const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n)}...` : s);

function stepHasContent(block: string, output: unknown): { ok: boolean; why: string } {
  const o = output as Record<string, unknown> | undefined;
  if (!o) return { ok: false, why: "no output" };
  if (block === "fetch_url") {
    const len = typeof o.text === "string" ? o.text.length : 0;
    return { ok: len >= 50, why: `text is ${len} chars (need >= 50)` };
  }
  const arrays = Object.values(o).filter(Array.isArray);
  if (arrays.length > 0) {
    const n = arrays.reduce((m, a) => Math.max(m, a.length), 0);
    return { ok: n > 0, why: `arrays are empty` };
  }
  return { ok: Object.values(o).some(Boolean), why: "output has no truthy fields" };
}

const SOURCE_CONTEXT_CHARS = 6_000;

/** The material the agent's writing step(s) saw, so the judge can check claims against it. */
function sourceContext(spec: AgentSpec, results: Record<string, StepResultLite>): string {
  const inputs = spec.steps
    .filter((s) => s.block === "llm" && results[s.id]?.ok)
    .map((s) => (results[s.id]?.resolvedParams as { input?: unknown } | undefined)?.input)
    .map((v) => (typeof v === "string" ? v : v === undefined ? "" : JSON.stringify(v)))
    .filter(Boolean);
  return inputs.join("\n---\n").slice(0, SOURCE_CONTEXT_CHARS);
}

async function judge(rubric: string, message: string, source: string): Promise<{ pass: boolean; reason: string; costUsd: number }> {
  if (isDemoMode()) return { ...CANNED_JUDGE_RESULT, costUsd: 0 };
  try {
    const r = await generateText({
      model: fastModel(),
      system:
        "You are a QA judge for an automated agent's output. Judge ONLY against the rubric, using the source material the agent was given to check its claims. " +
        "Fail only for a concrete, verifiable rubric violation. If a criterion cannot be checked from the message and source material, treat it as satisfied. " +
        "Give a one-sentence specific reason.",
      prompt: `Rubric: ${rubric}\n\nSource material the agent was given:\n${source || "(none captured)"}\n\nMessage to judge:\n${message}`,
      output: Output.object({ schema: z.object({ pass: z.boolean(), reason: z.string() }) }),
      abortSignal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
    });
    return { ...r.output, costUsd: callCostUsd(r) };
  } catch (e) {
    return { pass: false, reason: `judge call failed: ${(e as Error).message}`, costUsd: 0 };
  }
}

export async function runTests(
  spec: AgentSpec,
  output: RunOutput,
  results: Record<string, StepResultLite>,
): Promise<TestResult[]> {
  const out: TestResult[] = [];
  const message = output.message.trim();
  for (let i = 0; i < spec.tests.length; i++) {
    const t = spec.tests[i];
    const res = (passed: boolean, detail: string, costUsd = 0) => out.push({ testIndex: i, kind: t.kind, passed, detail, costUsd });
    switch (t.kind) {
      case "nonempty":
        if (message) res(true, `message has ${message.length} chars`);
        else if (output.changed === false) res(true, "message empty but nothing changed");
        else res(false, "final message is empty (and content changed or no diff step)");
        break;
      case "has_citations": {
        const bullets = bulletsOf(message);
        if (bullets.length === 0) {
          res(output.changed === false, output.changed === false ? "no bullets, nothing changed" : "no cited bullets");
          break;
        }
        const bad = bullets.filter((b) => !urlInLine(b));
        res(bad.length === 0, bad.length === 0 ? `all ${bullets.length} bullets have URLs` : `${bad.length}/${bullets.length} bullets lack a URL, e.g. "${clip(bad[0])}"`);
        break;
      }
      case "max_items": {
        const max = t.config?.max ?? 10;
        const n = bulletsOf(message).length;
        res(n <= max, `${n} bullets (max ${max})`);
        break;
      }
      case "llm_judge": {
        if (!message) {
          res(true, output.changed === false ? "nothing to judge (nothing changed)" : "nothing to judge (empty message)");
          break;
        }
        const j = await judge(t.config?.rubric ?? "The message is useful, accurate and well formed.", message, sourceContext(spec, results));
        res(j.pass, j.reason, j.costUsd);
        break;
      }
      case "no_post_if_unchanged":
        if (output.changed === false) res(!output.posted, output.posted ? "content unchanged but a message was posted" : "unchanged and nothing posted");
        else res(true, "n/a (content changed)");
        break;
      case "step_succeeds": {
        const id = t.config?.stepId;
        const r = id ? results[id] : undefined;
        if (!id) res(false, "step_succeeds test has no config.stepId");
        else if (!r) res(false, `step "${id}" did not run`);
        else if (!r.ok) res(false, `step "${id}" failed`);
        else {
          const block = spec.steps.find((s) => s.id === id)?.block ?? "";
          const c = stepHasContent(block, r.output);
          res(c.ok, c.ok ? `step "${id}" returned content` : `step "${id}" returned empty output: ${c.why}`);
        }
        break;
      }
    }
  }
  return out;
}
