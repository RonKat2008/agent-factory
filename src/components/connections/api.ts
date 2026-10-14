// Client calls for the Connections page. Secrets go up once on save; they never come back down.
export type Provider = "slack" | "github";

export interface ConnectionStatus {
  provider: Provider;
  connected: boolean;
  meta: Record<string, unknown>;
  via: "connection" | "env" | null;
  updatedAt: string | null;
}

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

export const getConnections = async () => (await call<{ connections: ConnectionStatus[] }>("/api/connections")).connections;
export const getUnlocked = async () => (await call<{ unlocked: boolean }>("/api/admin/session")).unlocked;
export const unlock = (key: string) => call<{ unlocked: boolean }>("/api/admin/session", { method: "POST", body: JSON.stringify({ key }) });
export const lock = () => call<{ unlocked: boolean }>("/api/admin/session", { method: "DELETE" });
export const saveConnection = (provider: Provider, body: Record<string, string>) =>
  call<{ connection: ConnectionStatus }>(`/api/connections/${provider}`, { method: "POST", body: JSON.stringify(body) });
export const disconnect = (provider: Provider) =>
  call<{ connection: ConnectionStatus }>(`/api/connections/${provider}`, { method: "DELETE" });
export const testConnection = (provider: Provider) =>
  call<{ ok: true; connection: ConnectionStatus }>(`/api/connections/${provider}/test`, { method: "POST" });
