// Connections: encrypted credentials for Slack + GitHub, stored in the `connections` table.
// Runtime getters read the connection first, then fall back to env vars (30s in-memory cache).
// Secrets never leave the server: listConnections() returns provider/connected/meta/via only.
import { query } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

export const PROVIDERS = ["slack", "github"] as const;
export type Provider = (typeof PROVIDERS)[number];
export type ConnectionVia = "connection" | "env" | null;
export type ConnectionMeta = Record<string, unknown>;

export interface ConnectionStatus {
  provider: Provider;
  connected: boolean;
  meta: ConnectionMeta;
  via: ConnectionVia;
  updatedAt: string | null;
}

interface Stored {
  secret: string;
  meta: ConnectionMeta;
  updatedAt: string;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<Provider, { at: number; value: Stored | null }>();

export const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/-]+$/;
export const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export function isProvider(p: string): p is Provider {
  return (PROVIDERS as readonly string[]).includes(p);
}

async function loadStored(provider: Provider): Promise<Stored | null> {
  const hit = cache.get(provider);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  let value: Stored | null = null;
  try {
    const rows = await query<{ secret_enc: string; meta: ConnectionMeta | null; updated_at: string }>(
      "select secret_enc, meta, updated_at from connections where provider = $1",
      [provider],
    );
    const row = rows[0];
    if (row) value = { secret: decryptSecret(row.secret_enc), meta: row.meta ?? {}, updatedAt: new Date(row.updated_at).toISOString() };
  } catch (e) {
    // Missing table (unmigrated env), no DB, or undecryptable secret: fall back to env, never throw.
    console.error(`[connections] load ${provider} failed:`, (e as Error).message);
  }
  cache.set(provider, { at: Date.now(), value });
  return value;
}

export async function saveConnection(provider: Provider, secret: string, meta: ConnectionMeta): Promise<void> {
  await query(
    `insert into connections (provider, secret_enc, meta, updated_at) values ($1, $2, $3::jsonb, now())
     on conflict (provider) do update set secret_enc = excluded.secret_enc, meta = excluded.meta, updated_at = now()`,
    [provider, encryptSecret(secret), JSON.stringify(meta)],
  );
  cache.delete(provider);
}

export async function updateConnectionMeta(provider: Provider, patch: ConnectionMeta): Promise<void> {
  await query("update connections set meta = meta || $2::jsonb where provider = $1", [provider, JSON.stringify(patch)]);
  cache.delete(provider);
}

export async function deleteConnection(provider: Provider): Promise<void> {
  await query("delete from connections where provider = $1", [provider]);
  cache.delete(provider);
}

function envSecret(provider: Provider): string | null {
  const v = provider === "slack" ? process.env.SLACK_WEBHOOK_URL : process.env.GITHUB_TOKEN;
  return v ? v : null;
}

export async function getConnectionStatus(provider: Provider): Promise<ConnectionStatus> {
  const stored = await loadStored(provider);
  if (stored) return { provider, connected: true, meta: stored.meta, via: "connection", updatedAt: stored.updatedAt };
  if (envSecret(provider)) return { provider, connected: true, meta: {}, via: "env", updatedAt: null };
  return { provider, connected: false, meta: {}, via: null, updatedAt: null };
}

export function listConnections(): Promise<ConnectionStatus[]> {
  return Promise.all(PROVIDERS.map(getConnectionStatus));
}

/** The stored secret for a provider (server-only), or the env fallback. */
export async function getSecret(provider: Provider): Promise<string | null> {
  return (await loadStored(provider))?.secret ?? envSecret(provider);
}

export const getSlackWebhook = (): Promise<string | null> => getSecret("slack");
export const getGithubToken = (): Promise<string | null> => getSecret("github");

/** Default repo saved with the GitHub connection, used when an agent spec omits one. */
export async function getGithubDefaultRepo(): Promise<string | null> {
  const repo = (await loadStored("github"))?.meta.repo;
  return typeof repo === "string" && REPO_RE.test(repo) ? repo : null;
}

// ---- provider checks (used by save/test routes) ----

export async function sendSlackTest(webhook: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "✅ Agent Factory connected" }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `Slack returned ${res.status}` };
  } catch (e) {
    return { ok: false, error: `Slack post failed: ${(e as Error).message}` };
  }
}

export interface GithubCheck {
  ok: boolean;
  error?: string;
  login?: string;
  repo?: string;
  private?: boolean;
  canPush?: boolean;
}

async function ghGet(path: string, token: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "user-agent": "agent-factory" },
    signal: AbortSignal.timeout(10_000),
  });
}

export async function checkGithub(token: string, repo: string): Promise<GithubCheck> {
  try {
    const u = await ghGet("/user", token);
    if (!u.ok) return { ok: false, error: u.status === 401 ? "GitHub rejected the token (401)" : `GitHub /user returned ${u.status}` };
    const user = (await u.json()) as { login?: string };
    const r = await ghGet(`/repos/${repo}`, token);
    if (!r.ok) return { ok: false, login: user.login, error: `Token can't see ${repo} (GitHub ${r.status})` };
    const info = (await r.json()) as { full_name?: string; private?: boolean; permissions?: { push?: boolean } };
    return { ok: true, login: user.login, repo: info.full_name ?? repo, private: !!info.private, canPush: !!info.permissions?.push };
  } catch (e) {
    return { ok: false, error: `GitHub check failed: ${(e as Error).message}` };
  }
}
