// Mock-mode build simulation (NEXT_PUBLIC_USE_MOCKS=true): replays a scripted build for the
// mock agent so the build stage can be seen without a backend. Isolated here on purpose.
import { getAgent } from "@/lib/api-client";
import type { AgentDetail, EventType, FeedEvent } from "@/lib/types";

export const MOCK_MODE = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
export const MOCK_AGENT_ID = "33333333-3333-4333-8333-333333333333";

type Beat = { at: number; type: EventType; message: string };
const BEATS: Beat[] = [
  { at: 700, type: "built", message: "Built v1: fetch_url → llm → send_slack, 3 tests" },
  { at: 1400, type: "dry_run", message: "Dry run against live sources (1.8s, $0.0009)" },
  { at: 2100, type: "test_failed", message: "has_citations: 2 of 5 bullets have no source URL" },
  { at: 2800, type: "self_fixed", message: "tightened the llm instruction to cite every release; v2 written" },
  { at: 3500, type: "tests_passed", message: "v2 passed 3/3 tests on dry run" },
];

export async function simulateSnapshot(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  const base = await getAgent(MOCK_AGENT_ID);
  if (!base) return null;
  const done = BEATS.filter((b) => b.at <= elapsed);
  const events: FeedEvent[] = done.map((b, i) => ({
    id: `sim${i}`,
    agentId: MOCK_AGENT_ID,
    agentName: base.agent.name,
    type: b.type,
    message: b.message,
    data: null,
    createdAt: new Date(startedAt + b.at).toISOString(),
  }));
  const status = done.length >= BEATS.length ? "ready" : elapsed > 1400 ? "testing" : "building";
  const detail: AgentDetail = {
    ...base,
    agent: { ...base.agent, status, plan: elapsed > 700 ? base.agent.plan : null },
  };
  return { detail, events };
}
