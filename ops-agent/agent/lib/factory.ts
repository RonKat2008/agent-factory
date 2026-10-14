const DEFAULT_FACTORY_URL = "https://agent-factory-steel.vercel.app";
const REQUEST_TIMEOUT_MS = 20_000;

export function factoryUrl(): string {
  return (process.env.FACTORY_URL || DEFAULT_FACTORY_URL).replace(/\/+$/, "");
}

export function agentLink(id: string): string {
  return `${factoryUrl()}/agents/${id}`;
}

/** Call the Agent Factory JSON API. Throws an actionable error on non-2xx. */
export async function factory<T = unknown>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const url = `${factoryUrl()}${path}`;
  const method = init?.method ?? "GET";
  const res = await fetch(url, {
    method,
    headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : text.slice(0, 200);
    throw new Error(
      `Agent Factory ${method} ${path} failed with HTTP ${res.status}: ${detail || res.statusText}` +
        (res.status === 404 ? " (route or agent not found; it may not be deployed yet)" : ""),
    );
  }
  return data as T;
}

type Json = Record<string, unknown>;

/** Compact an Agent row for the model. */
export function summarizeAgent(a: Json): Json {
  return {
    id: a.id,
    name: a.name,
    status: a.status,
    currentVersion: a.currentVersion,
    health: a.health,
    schedule: a.scheduleHuman ?? a.schedule,
    nextRunAt: a.nextRunAt,
    lastRunAt: a.lastRunAt,
    requiresApproval: a.requiresApproval,
    runs: a.runs,
    successRate: a.successRate,
    repairs: a.repairs,
    usefulRate: a.usefulRate,
    costUsd: a.costUsd,
    link: typeof a.id === "string" ? agentLink(a.id) : undefined,
  };
}

const MAX_TEXT = 400;

function clip(value: unknown): unknown {
  if (typeof value === "string") return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  if (value === null || value === undefined) return value;
  const s = JSON.stringify(value);
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : value;
}

/** Compact a Run row: drop bulky step payloads, keep failures and test results. */
export function summarizeRun(r: Json): Json {
  const steps = Array.isArray(r.steps) ? (r.steps as Json[]) : [];
  const tests = Array.isArray(r.tests) ? (r.tests as Json[]) : [];
  return {
    id: r.id,
    version: r.version,
    kind: r.kind,
    status: r.status,
    error: clip(r.error),
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    costUsd: r.costUsd,
    failedSteps: steps
      .filter((s) => Boolean(s.error) || (s.status !== undefined && s.status !== "ok" && s.status !== "skipped"))
      .map((s) => ({ id: s.id ?? s.stepId, block: s.block, error: clip(s.error) })),
    tests: tests.map((t) => ({ kind: t.kind, passed: t.passed, detail: t.passed ? undefined : clip(t.detail) })),
    feedback: r.feedback ?? undefined,
  };
}
