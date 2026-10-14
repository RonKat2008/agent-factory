import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Blocks, Code2, Globe } from "lucide-react";

export const metadata: Metadata = { title: "Build a connector · Pitcrew" };

const LABEL = "font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500";
const PANEL = "rounded-[3px] border border-stone-300 bg-[#FBFAF7] p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]";
const CODE = "overflow-x-auto rounded-[3px] border border-stone-300 bg-stone-950 p-3 font-mono text-[12px] leading-relaxed text-stone-100";

const BLOCK_FILE = `// src/lib/blocks/weather.ts
import { safeFetch } from "@/lib/net";
import { fail, ok, type BlockRunner } from "./types";

export const weather: BlockRunner = async (params) => {
  const { latitude, longitude } = params ?? {};
  if (latitude == null || longitude == null) return fail("weather: latitude and longitude are required");
  const url = \`https://api.open-meteo.com/v1/forecast?latitude=\${latitude}&longitude=\${longitude}&current=temperature_2m\`;
  const res = await safeFetch(url); // SSRF guard + 10s timeout
  if (!res.ok) return fail(\`HTTP \${res.status} from open-meteo\`);
  const data = await res.json();
  return ok({ temperatureC: data.current.temperature_2m, text: JSON.stringify(data.current) });
};`;

const SPEC_ENTRY = `// src/lib/spec.ts: add a step type and put it in the StepSchema union
const Weather = z.object({
  id: z.string(),
  block: z.literal("weather"),
  params: z.object({ latitude: z.number(), longitude: z.number() }),
});
export const StepSchema = z.discriminatedUnion("block", [/* …, */ Weather]);`;

const REGISTRY_ENTRY = `// src/lib/blocks/index.ts: register it (the builder reads this catalog)
weather: {
  run: weather,
  description: "Current temperature for a latitude/longitude (Open-Meteo).",
  params: "{ latitude, longitude }",
  outputs: "{ temperatureC, text }",
},
// …and one EXAMPLES line so the builder sees it used:
weather: '{"id":"wx","block":"weather","params":{"latitude":37.77,"longitude":-122.42}}  -> {{steps.wx.temperatureC}}',`;

const CONNECTOR_STEP = `{"id":"wx","block":"connector","params":{
  "connector":"open_meteo","action":"forecast",
  "args":[{"name":"latitude","value":"37.77"},{"name":"longitude","value":"-122.42"}]}}
-> {{steps.wx.text}}  {{steps.wx.data}}  {{steps.wx.items}}`;

export default function BuildConnectorPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 border-b border-stone-300 pb-5">
        <Link href="/connections" className="inline-flex w-fit items-center gap-1 text-[13px] text-stone-600 hover:text-stone-900">
          <ArrowLeft className="size-3.5" aria-hidden /> Connections
        </Link>
        <p className={LABEL}>Developers · extend Pitcrew</p>
        <h1 className="text-[28px] font-semibold tracking-tight text-stone-900">Build a connector</h1>
        <p className="max-w-[68ch] text-[14px] text-stone-600">
          Agents are JSON specs made of blocks. There are two ways to give them a new capability: add a <strong className="font-semibold text-stone-800">community connector</strong> from the
          website (no code, live immediately), or ship a <strong className="font-semibold text-stone-800">first-class block</strong> in code.
        </p>
      </header>

      <section aria-labelledby="kinds-heading" className="flex flex-col gap-3">
        <h2 id="kinds-heading" className={LABEL}>No code · from the Connections page</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <article className={PANEL}>
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-stone-700" aria-hidden />
              <h3 className="text-[14px] font-semibold text-stone-900">HTTP API</h3>
            </div>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[13px] text-stone-700">
              <li>A public <span className="font-mono">https://</span> base URL and an optional auth header (the secret is AES-GCM encrypted and never shown again).</li>
              <li>1–8 actions: snake_case name, plain-English description, GET or POST, a path like <span className="font-mono">/users/{"{id}"}</span>, and params in the path, query or JSON body.</li>
              <li>Test runs one action and shows the response before you save.</li>
            </ul>
          </article>
          <article className={PANEL}>
            <div className="flex items-center gap-2">
              <Blocks className="size-4 text-violet-700" aria-hidden />
              <h3 className="text-[14px] font-semibold text-stone-900">MCP server</h3>
            </div>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[13px] text-stone-700">
              <li>A remote MCP server URL (Streamable HTTP, e.g. <span className="font-mono">https://mcp.deepwiki.com/mcp</span>) and an optional bearer token.</li>
              <li>On save Pitcrew runs <span className="font-mono">initialize</span> and <span className="font-mono">tools/list</span>; every tool becomes an action.</li>
              <li>At run time the agent calls <span className="font-mono">tools/call</span> with the step&apos;s args.</li>
            </ul>
          </article>
        </div>
        <div className={PANEL}>
          <p className="text-[13px] text-stone-700">
            Either way the builder sees the connector in its catalog on the very next build and uses it through the generic <span className="font-mono">connector</span> block:
          </p>
          <pre className={`${CODE} mt-2`}>{CONNECTOR_STEP}</pre>
          <p className="mt-2 text-[12.5px] text-stone-600">
            Calls go through the SSRF guard (public hosts only, redirects re-checked), time out after 10s and cap the response size. Errors are recorded on the step, so self-repair can see them.
          </p>
        </div>
      </section>

      <section aria-labelledby="code-heading" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Code2 className="size-4 text-stone-700" aria-hidden />
          <h2 id="code-heading" className={LABEL}>In code · a first-class built-in block</h2>
        </div>
        <p className="max-w-[72ch] text-[13px] text-stone-700">
          Use a block when the capability needs custom logic, typed params or its own tests. Three edits: the block file, a spec union entry, and a registry entry.
          Blocks never throw. Return <span className="font-mono">ok(output)</span> or <span className="font-mono">fail(&quot;precise error&quot;)</span> so Pitcrew can test and repair agents that use it.
        </p>
        <ol className="flex flex-col gap-3">
          <li className="flex flex-col gap-1.5">
            <span className="font-mono text-[12px] text-stone-500">1 · block</span>
            <pre className={CODE}>{BLOCK_FILE}</pre>
          </li>
          <li className="flex flex-col gap-1.5">
            <span className="font-mono text-[12px] text-stone-500">2 · spec</span>
            <pre className={CODE}>{SPEC_ENTRY}</pre>
          </li>
          <li className="flex flex-col gap-1.5">
            <span className="font-mono text-[12px] text-stone-500">3 · registry</span>
            <pre className={CODE}>{REGISTRY_ENTRY}</pre>
          </li>
        </ol>
        <p className="text-[12.5px] text-stone-600">
          Then run <span className="font-mono">npm run verify</span>. TypeScript flags every exhaustive switch over blocks (e.g. the eve exporter) that needs a case for the new block.
        </p>
      </section>
    </div>
  );
}
