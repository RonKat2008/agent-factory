import { Sandbox } from "@vercel/sandbox";
import { fail, ok, type BlockRunner } from "./types";

const MAX_INPUT_BYTES = 200 * 1024;
const MAX_OUTPUT_BYTES = 100 * 1024;
const SANDBOX_TIMEOUT_MS = 60_000;
const RUN_DEADLINE_MS = 50_000;
const MARKER = "__RESULT__";
const STDERR_TAIL = 600;

// Harness runs inside the microVM. The user's code is a JSON string literal -> AsyncFunction body.
const buildHarness = (code: string) => `import { readFileSync } from "node:fs";
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
try {
  const input = JSON.parse(readFileSync("/tmp/input.json", "utf8"));
  const fn = new AsyncFunction("input", ${JSON.stringify(code)});
  const result = await fn(input);
  const out = JSON.stringify(result === undefined ? null : result);
  process.stdout.write("\\n${MARKER}" + out + "\\n");
} catch (e) {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
}
`;

const tail = (s: string, n = STDERR_TAIL) => (s.length > n ? "…" + s.slice(-n) : s).trim();
const isDemo = () => process.env.DEMO_MODE === "true";

type Engine = "vercel-sandbox" | "local-demo";
type Outcome = { value: unknown; engine: Engine; sandboxId?: string };

async function runInSandbox(code: string, inputJson: string): Promise<Outcome> {
  // Create failures propagate as { created:false } so the caller can decide on the demo fallback.
  const sandbox = await Sandbox.create({
    runtime: "node24",
    timeout: SANDBOX_TIMEOUT_MS,
    resources: { vcpus: 1 },
    networkPolicy: "deny-all",
    persistent: false,
  });
  try {
    await sandbox.writeFiles([
      { path: "/tmp/job.mjs", content: Buffer.from(buildHarness(code)) },
      { path: "/tmp/input.json", content: Buffer.from(inputJson) },
    ]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new Error(`timed out after ${RUN_DEADLINE_MS / 1000}s`)), RUN_DEADLINE_MS);
    });
    const res = await Promise.race([sandbox.runCommand("node", ["/tmp/job.mjs"]), deadline]).finally(() => clearTimeout(timer));
    const [stdout, stderr] = await Promise.all([res.stdout(), res.stderr()]);
    if (res.exitCode !== 0) throw new Error(`exit ${res.exitCode}: ${tail(stderr) || tail(stdout) || "no output"}`);
    const idx = stdout.lastIndexOf(MARKER);
    if (idx < 0) throw new Error(`no ${MARKER} in stdout (stdout: ${tail(stdout, 200)}; stderr: ${tail(stderr, 200)})`);
    const json = stdout.slice(idx + MARKER.length).trim();
    if (Buffer.byteLength(json) > MAX_OUTPUT_BYTES) throw new Error(`output exceeds ${MAX_OUTPUT_BYTES / 1024}KB cap (${Buffer.byteLength(json)} bytes)`);
    let value: unknown;
    try {
      value = JSON.parse(json);
    } catch {
      throw new Error(`result was not valid JSON: ${tail(json, 200)}`);
    }
    return { value, engine: "vercel-sandbox", sandboxId: sandbox.name };
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

// DEMO_MODE only: in-process fallback when the sandbox can't be created.
async function runLocal(code: string, input: unknown): Promise<Outcome> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const value = await new AsyncFunction("input", code)(input);
  const json = JSON.stringify(value === undefined ? null : value);
  if (Buffer.byteLength(json) > MAX_OUTPUT_BYTES) throw new Error(`output exceeds ${MAX_OUTPUT_BYTES / 1024}KB cap`);
  return { value: JSON.parse(json), engine: "local-demo" };
}

export const runCode: BlockRunner = async (params) => {
  const { code, input } = params ?? {};
  if (typeof code !== "string" || !code.trim()) return fail("run_code: `code` must be a non-empty string");
  let inputJson: string;
  try {
    inputJson = JSON.stringify(input === undefined ? null : input);
  } catch (e) {
    return fail(`run_code: input is not JSON-serializable: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (Buffer.byteLength(inputJson) > MAX_INPUT_BYTES) {
    return fail(`run_code: input is ${Buffer.byteLength(inputJson)} bytes, over the ${MAX_INPUT_BYTES / 1024}KB cap; filter or trim it first`);
  }

  const t0 = Date.now();
  let outcome: Outcome;
  try {
    outcome = await runInSandbox(code, inputJson);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const createFailed = !(e instanceof Error) || !/^(exit \d+|no __RESULT__|result was not|output exceeds|timed out)/.test(msg);
    if (isDemo() && createFailed) {
      try {
        outcome = await runLocal(code, JSON.parse(inputJson));
      } catch (e2) {
        return fail(`run_code: ${e2 instanceof Error ? e2.message : String(e2)}`);
      }
    } else {
      return fail(`run_code: ${msg}`);
    }
  }

  const { value, engine, sandboxId } = outcome;
  const output: Record<string, unknown> = { result: value, ms: Date.now() - t0, engine, sandboxId: sandboxId ?? null };
  if (Array.isArray(value)) output.items = value;
  return ok(output);
};
