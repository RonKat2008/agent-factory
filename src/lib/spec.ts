// Agent spec: the contract between the builder (LLM), the runtime, and repair.
// Agents are JSON specs made of blocks — never generated code.
import { z } from "zod";

// "{{steps.<id>.<field>}}" — if a param is exactly one template it resolves to the raw value
// (array/object); otherwise templates are interpolated as strings.
const tpl = z.string().describe('Literal text or a template like "{{steps.page.text}}"');

const FetchUrl = z.object({
  id: z.string(),
  block: z.literal("fetch_url"),
  params: z.object({ url: z.string().describe("Absolute http(s) URL") }),
});
const FetchRss = z.object({
  id: z.string(),
  block: z.literal("fetch_rss"),
  params: z.object({ url: z.string(), limit: z.number().int().min(1).max(50).optional() }),
});
const HnSearch = z.object({
  id: z.string(),
  block: z.literal("hn_search"),
  params: z.object({
    query: z.string(),
    minPoints: z.number().int().optional(),
    sinceHours: z.number().int().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
});
const GithubIssues = z.object({
  id: z.string(),
  block: z.literal("github_issues"),
  params: z.object({
    repo: z.string().describe('"owner/name"'),
    action: z.enum(["list", "label"]),
    sinceHours: z.number().int().optional(),
    // action=label: template resolving to [{ number, labels: string[], comment?: string }]
    input: tpl.optional(),
  }),
});
const Llm = z.object({
  id: z.string(),
  block: z.literal("llm"),
  params: z.object({
    instruction: z.string(),
    input: tpl,
    format: z.enum(["text", "cited_bullets", "issue_labels"]),
  }),
});
const Filter = z.object({
  id: z.string(),
  block: z.literal("filter"),
  params: z.object({
    input: tpl.describe("Template resolving to an items array"),
    field: z.string(),
    op: z.enum(["gt", "gte", "lt", "lte", "eq", "contains"]),
    value: z.union([z.string(), z.number()]),
  }),
});
const DiffWithMemory = z.object({
  id: z.string(),
  block: z.literal("diff_with_memory"),
  params: z.object({ input: tpl, memoryKey: z.string() }),
});
const SendSlack = z.object({
  id: z.string(),
  block: z.literal("send_slack"),
  params: z.object({ message: tpl, skipIfEmpty: z.boolean().optional() }),
});
const RequireApproval = z.object({
  id: z.string(),
  block: z.literal("require_approval"),
  params: z.object({ message: tpl.optional() }),
});

const RunCode = z.object({
  id: z.string(),
  block: z.literal("run_code"),
  params: z.object({
    code: z
      .string()
      .describe("Body of an async JS function (input) => result. `input` is the resolved input value. Return JSON-serializable data. No network, no imports."),
    input: tpl,
  }),
});

// A user-added custom connector (HTTP API or MCP server) from /connections.
const Connector = z.object({
  id: z.string(),
  block: z.literal("connector"),
  params: z.object({
    connector: z.string().describe("Connector slug from the custom connectors catalog"),
    action: z.string().describe("Action (or MCP tool) name on that connector"),
    // An array (not a record): record schemas come back empty from the gateway's structured output.
    args: z
      .array(z.object({ name: z.string(), value: tpl }))
      .describe("One entry per argument: name = the action's param name, value = literal text or a template"),
  }),
});

const Recall = z.object({
  id: z.string(),
  block: z.literal("recall"),
  params: z.object({
    query: tpl.describe("Entity or topic to look up in the fleet's shared knowledge"),
    limit: z.number().int().min(1).max(20).optional(),
  }),
});

export const StepSchema = z.discriminatedUnion("block", [
  FetchUrl,
  FetchRss,
  HnSearch,
  GithubIssues,
  Llm,
  Filter,
  DiffWithMemory,
  SendSlack,
  RequireApproval,
  RunCode,
  Connector,
  Recall,
]);
export type Step = z.infer<typeof StepSchema>;
export type BlockName = Step["block"];

export const TEST_KINDS = [
  "nonempty", // final message is non-empty (unless nothing changed)
  "has_citations", // every bullet in the final message has a URL
  "max_items", // config.max: at most N bullets
  "llm_judge", // config.rubric: haiku judges the final message
  "no_post_if_unchanged", // when diff reports no change, nothing is posted
  "step_succeeds", // config.stepId: that step returns ok with non-empty output (repair regression tests)
] as const;

export const TestSchema = z.object({
  kind: z.enum(TEST_KINDS),
  config: z
    .object({
      max: z.number().int().optional(),
      rubric: z.string().optional(),
      stepId: z.string().optional(),
    })
    .optional(),
  addedBy: z.enum(["build", "repair", "user"]).optional(),
  note: z.string().optional().describe("Why this test exists, e.g. the failure it guards against"),
});
export type AgentTest = z.infer<typeof TestSchema>;

export const PlanCardSchema = z.object({
  runs: z.string().describe('Plain English schedule, e.g. "Every weekday at 9:00"'),
  checks: z.string().describe("What sources it reads"),
  does: z.string().describe("What it does with them"),
  sendsTo: z.string(),
  asksBefore: z.string().describe('"Nothing" or what needs approval'),
});
export type PlanCard = z.infer<typeof PlanCardSchema>;

export const AgentSpecSchema = z.object({
  name: z.string(),
  schedule: z.string().describe('5-field cron expression, UTC, e.g. "0 16 * * *"'),
  steps: z.array(StepSchema).min(1),
  tests: z.array(TestSchema).min(1),
  requiresApproval: z.boolean(),
  plan: PlanCardSchema,
  // Chain: also run whenever the upstream agent successfully POSTS. Params may then use
  // {{trigger.message}}, {{trigger.agentName}}, {{trigger.citations}} ({text,url}[]).
  trigger: z
    .object({
      agentId: z.string().describe("id of the upstream agent"),
      when: z.literal("posted"),
    })
    .optional(),
});
export type AgentSpec = z.infer<typeof AgentSpecSchema>;

// What every block returns. Blocks never throw — self-repair depends on recorded errors.
export type BlockResult<T = Record<string, unknown>> =
  | { ok: true; output: T; error?: undefined; costUsd?: number }
  | { ok: false; output?: undefined; error: string; costUsd?: number };

// Normalized final output a run produces (what tests check and what gets sent).
export type RunOutput = {
  message: string; // markdown that is / would be sent
  citations: { text: string; url: string }[];
  posted: boolean;
  changed: boolean | null; // from diff_with_memory, null when the spec has no diff step
};
