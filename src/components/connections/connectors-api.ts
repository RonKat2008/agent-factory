// Client calls for community (custom) connectors. Secrets go up on save/test; they never come back down.
export type ParamLocation = "path" | "query" | "body";

export interface ConnectorParam {
  name: string;
  description: string;
  in: ParamLocation;
  required: boolean;
}

export interface ConnectorAction {
  name: string;
  description: string;
  method?: "GET" | "POST";
  path?: string;
  params: ConnectorParam[];
}

export interface CommunityConnector {
  id: string;
  slug: string;
  kind: "http" | "mcp";
  name: string;
  baseUrl: string;
  authHeader: string | null;
  hasSecret: boolean;
  actions: ConnectorAction[];
  createdAt: string;
  canDelete: boolean;
}

export interface CallOutput {
  status: number;
  data: unknown;
  text: string;
  items?: Record<string, unknown>[];
  truncated?: boolean;
}

export type TestResponse =
  | { ok: true; result?: CallOutput; actions?: ConnectorAction[]; total?: number }
  | { ok: false; error: string; actions?: ConnectorAction[] };

export type HttpDraft = {
  kind: "http";
  name: string;
  baseUrl: string;
  authHeader: string;
  secret: string;
  actions: { name: string; description: string; method: "GET" | "POST"; path: string; params: ConnectorParam[] }[];
};
export type McpDraft = { kind: "mcp"; name: string; baseUrl: string; secret: string };
export type ConnectorDraft = HttpDraft | McpDraft;

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

export const listConnectors = async () => (await call<{ connectors: CommunityConnector[]; max: number }>("/api/connectors"));
export const createConnector = (draft: ConnectorDraft) =>
  call<{ connector: CommunityConnector }>("/api/connectors", { method: "POST", body: JSON.stringify(draft) });
export const deleteConnector = (slug: string) => call<{ deleted: string }>(`/api/connectors/${encodeURIComponent(slug)}`, { method: "DELETE" });
export const previewConnector = (draft: ConnectorDraft, action?: string, args: Record<string, string> = {}) =>
  call<TestResponse>("/api/connectors/preview", { method: "POST", body: JSON.stringify({ draft, action, args }) });
export const testSavedConnector = (slug: string, action: string, args: Record<string, string>) =>
  call<TestResponse>(`/api/connectors/${encodeURIComponent(slug)}/test`, { method: "POST", body: JSON.stringify({ action, args }) });
