// Client-side API wrapper. Pages call ONLY these. With NEXT_PUBLIC_USE_MOCKS=true they return mock data.
import type { Agent, AgentDetail, FeedEvent, OutboxMessage, Run, Stats } from "./types";
import * as mock from "./mock";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    cache: "no-store",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body;
}

const post = <T>(path: string, data?: unknown) =>
  call<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });

export async function getAgents(): Promise<Agent[]> {
  if (USE_MOCKS) return mock.agents;
  return (await call<{ agents: Agent[] }>("/api/agents")).agents;
}

export async function getAgent(id: string): Promise<AgentDetail | null> {
  if (USE_MOCKS) return mock.agentDetail(id);
  return call<AgentDetail>(`/api/agents/${id}`);
}

export async function getRun(id: string): Promise<Run | null> {
  if (USE_MOCKS) return mock.agentDetail(mock.agents[1].id)?.runs.find((r) => r.id === id) ?? null;
  return (await call<{ run: Run }>(`/api/runs/${id}`)).run;
}

export async function getFeed(opts: { since?: string; agentId?: string } = {}): Promise<FeedEvent[]> {
  if (USE_MOCKS) return mock.events.filter((e) => !opts.agentId || e.agentId === opts.agentId);
  const q = new URLSearchParams();
  if (opts.since) q.set("since", opts.since);
  if (opts.agentId) q.set("agentId", opts.agentId);
  return (await call<{ events: FeedEvent[] }>(`/api/feed?${q}`)).events;
}

export async function getStats(): Promise<Stats> {
  if (USE_MOCKS) return mock.stats;
  return call<Stats>("/api/stats");
}

export async function getOutbox(): Promise<OutboxMessage[]> {
  if (USE_MOCKS) return mock.outbox;
  return (await call<{ messages: OutboxMessage[] }>("/api/outbox")).messages;
}

export const createAgent = (request: string) => post<{ agentId: string }>("/api/agents", { request });
export const goLive = (id: string) => post<{ agent: Agent }>(`/api/agents/${id}/golive`);
export const runNow = (id: string) => post<{ runId: string }>(`/api/agents/${id}/run`);
export const setPaused = (id: string, paused: boolean) =>
  post<{ agent: Agent }>(`/api/agents/${id}/pause`, { paused });
export const setApproval = (id: string, requiresApproval: boolean) =>
  post<{ agent: Agent }>(`/api/agents/${id}/approval`, { requiresApproval });
export const editAgent = (id: string, instruction: string) =>
  post<{ version: number }>(`/api/agents/${id}/edit`, { instruction });
export const acceptVersion = (id: string, v: number) =>
  post<{ agent: Agent }>(`/api/agents/${id}/versions/${v}/accept`);
export const rejectVersion = (id: string, v: number) =>
  post<{ ok: true }>(`/api/agents/${id}/versions/${v}/reject`);
export const approveRun = (runId: string, approve: boolean) =>
  post<{ run: Run }>(`/api/runs/${runId}/approve`, { approve });
