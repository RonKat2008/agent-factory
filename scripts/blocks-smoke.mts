// Run: npx tsx --env-file=.env.local scripts/blocks-smoke.mts   (real network + AI Gateway calls)
import { runBlock } from "../src/lib/blocks";
import type { BlockContext } from "../src/lib/blocks/types";
import { deriveRunOutput } from "../src/lib/runtime/output";
import { resolveParams } from "../src/lib/runtime/template";
import { runTests } from "../src/lib/runtime/tests";
import type { AgentSpec, Step } from "../src/lib/spec";

const mem = new Map<string, unknown>();
const ctx: BlockContext = {
  agentId: "a", runId: "r", dryRun: false, appUrl: "http://localhost:3001",
  memoryGet: async (k) => mem.get(k),
  memorySet: async (k, v) => void mem.set(k, v),
  deliver: async () => ({ sent: true }),
};
const step = (block: string, params: unknown) => ({ id: "x", block, params }) as Step;
const show = (label: string, v: unknown) => console.log(`\n== ${label}\n`, JSON.stringify(v, null, 1).slice(0, 700));

const ex = await runBlock(step("fetch_url", { url: "https://example.com" }), { url: "https://example.com" }, ctx);
show("fetch_url example.com", ex.ok ? { ...ex.output, text: String(ex.output.text).slice(0, 100) } : ex);
const nf = await runBlock(step("fetch_url", {}), { url: "https://example.com/nope-404" }, ctx);
show("fetch_url 404", nf);
show("fetch_url ssrf", await runBlock(step("fetch_url", {}), { url: "http://127.0.0.1:8080/x" }, ctx));

const hn = await runBlock(step("hn_search", {}), { query: "AI agents", sinceHours: 168, limit: 8 }, ctx);
show("hn_search", hn);
const rss = await runBlock(step("fetch_rss", {}), { url: "https://github.com/vercel/next.js/releases.atom", limit: 3 }, ctx);
show("fetch_rss", rss);

const steps = { hn: hn.ok ? hn.output : {} , n: { v: 5 } };
show("resolve exact", resolveParams({ a: "{{steps.hn.items.0.title}}", b: "{{steps.hn.items}}".length }, steps));
show("resolve interp", resolveParams("n={{steps.n.v}} list:\n{{steps.hn.items}}\nmiss={{steps.zz.q}}", steps));
show("resolve raw array", Array.isArray((resolveParams("{{steps.hn.items}}", steps).value as unknown[])));

const llm = await runBlock(step("llm", {}), { instruction: "Pick the 3 most interesting items", input: hn.ok ? hn.output.items : [], format: "cited_bullets" }, ctx);
show("llm cited_bullets", llm);

const spec = { name: "t", schedule: "0 * * * *", requiresApproval: false, plan: {} as never,
  steps: [{ id: "hn", block: "hn_search", params: {} }, { id: "sum", block: "llm", params: {} }, { id: "post", block: "send_slack", params: {} }],
  tests: [{ kind: "nonempty" }, { kind: "has_citations" }, { kind: "max_items", config: { max: 5 } }, { kind: "llm_judge", config: { rubric: "Each bullet is a short sentence about AI agents" } }, { kind: "no_post_if_unchanged" }, { kind: "step_succeeds", config: { stepId: "hn" } }],
} as unknown as AgentSpec;
const md = llm.ok ? String(llm.output.markdown) : "";
const results = { hn: { ok: hn.ok, output: hn.output, resolvedParams: {} }, sum: { ok: llm.ok, output: llm.output, resolvedParams: {} }, post: { ok: true, output: { sent: true }, resolvedParams: { message: md } } };
const out = deriveRunOutput(spec, results);
show("deriveRunOutput", out);
show("runTests", await runTests(spec, out, results));
show("runTests bad (no URL bullets)", await runTests(spec, { message: "• no link here", citations: [], posted: true, changed: false }, results));
console.log("\nllm cost USD:", llm.costUsd);
