// "Sign in with Slack" OAuth (bot scopes incoming-webhook + users:read): signed state, authorize URL,
// code exchange, and the one users.info lookup. Server-only. The webhook URL and bot token are secrets:
// never log, store in plain text, or return them. The bot token is used once and discarded.
import { randomBytes } from "node:crypto";
import { SLACK_WEBHOOK_RE } from "./connections";
import { hasTokenSecret, signToken, verifyToken } from "./signed-token";

const STATE_LABEL = "slack-state";
const STATE_TTL_MS = 10 * 60 * 1000;
const SLACK_TIMEOUT_MS = 10_000;
const AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const ACCESS_URL = "https://slack.com/api/oauth.v2.access";
const USERS_INFO_URL = "https://slack.com/api/users.info";
export const SLACK_SCOPES = "incoming-webhook,users:read";

export interface OAuthState {
  v: string; // anonymous visitor id (af_uid) that started the flow
  a: string | null; // agent id to wire up, if any
  r: string; // return path
  n: string; // nonce
}

export function isSlackOAuthConfigured(): boolean {
  return !!process.env.SLACK_CLIENT_ID && !!process.env.SLACK_CLIENT_SECRET && hasTokenSecret();
}

export function appBaseUrl(fallbackOrigin: string): string {
  return (process.env.APP_URL || fallbackOrigin).replace(/\/$/, "");
}

/** Hosts the OAuth round-trip may return to (each must also be registered in the Slack app). */
const ALLOWED_OAUTH_HOSTS = new Set(
  ["pitcrew-ai.vercel.app", "agent-factory-steel.vercel.app", ...(process.env.SLACK_REDIRECT_HOSTS ?? "").split(",")]
    .map((h) => h.trim())
    .filter(Boolean),
);

/**
 * Return to the same origin the flow started on, so the visitor cookie bound into `state`
 * is present at the callback. Falls back to APP_URL for unknown hosts.
 */
export function oauthBaseUrl(requestOrigin: string): string {
  try {
    const u = new URL(requestOrigin);
    if (u.protocol === "https:" && ALLOWED_OAUTH_HOSTS.has(u.host)) return u.origin;
  } catch {
    // fall through to APP_URL
  }
  return appBaseUrl(requestOrigin);
}

export function redirectUri(requestOrigin: string): string {
  return `${oauthBaseUrl(requestOrigin)}/api/slack/oauth/callback`;
}

/** Only same-site relative paths ("/x", never "//x" or "/\\x"); anything else becomes "/connections". */
export function safeReturnPath(p: unknown): string {
  if (typeof p !== "string" || p.length > 300) return "/connections";
  if (!p.startsWith("/") || p.startsWith("//") || p.startsWith("/\\")) return "/connections";
  return p;
}

export function signState(input: { visitorId: string; agentId: string | null; returnTo: string }, now = Date.now()): string {
  const state: OAuthState = { v: input.visitorId, a: input.agentId, r: safeReturnPath(input.returnTo), n: randomBytes(9).toString("base64url") };
  return signToken(STATE_LABEL, state, STATE_TTL_MS, now);
}

/** Decoded state, or null when malformed, tampered or expired. */
export function verifyState(token: unknown, now = Date.now()): OAuthState | null {
  const s = verifyToken<OAuthState>(STATE_LABEL, token, now);
  if (!s || typeof s.v !== "string" || typeof s.n !== "string") return null;
  return { v: s.v, a: typeof s.a === "string" ? s.a : null, r: safeReturnPath(s.r), n: s.n };
}

export function authorizeUrl(state: string, fallbackOrigin: string): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("client_id", process.env.SLACK_CLIENT_ID ?? "");
  u.searchParams.set("scope", SLACK_SCOPES);
  u.searchParams.set("redirect_uri", redirectUri(fallbackOrigin));
  u.searchParams.set("state", state);
  return u.toString();
}

export interface SlackGrant {
  webhookUrl: string;
  channel: string;
  channelId: string | null;
  configurationUrl: string | null;
  teamId: string;
  teamName: string;
  slackUserId: string;
  botToken: string | null;
}

export interface SlackProfile {
  name: string;
  avatar: string | null;
}

interface AccessResponse {
  ok?: boolean;
  error?: string;
  access_token?: string;
  team?: { id?: string; name?: string };
  authed_user?: { id?: string };
  incoming_webhook?: { url?: string; channel?: string; channel_id?: string; configuration_url?: string };
}

const SLACK_ID_RE = /^[A-Z0-9]{2,32}$/;

/** Exchanges the code. Throws Error(reason) with a short, secret-free reason. */
export async function exchangeCode(code: string, fallbackOrigin: string): Promise<SlackGrant> {
  const body = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID ?? "",
    client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
    code,
    redirect_uri: redirectUri(fallbackOrigin),
  });
  const res = await fetch(ACCESS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`slack_http_${res.status}`);
  const data = (await res.json()) as AccessResponse;
  if (!data.ok) throw new Error(String(data.error ?? "exchange_failed").replace(/[^\w.-]/g, "").slice(0, 60));
  const hook = data.incoming_webhook;
  if (!hook?.url || !SLACK_WEBHOOK_RE.test(hook.url)) throw new Error("no_webhook");
  const teamId = String(data.team?.id ?? "");
  const slackUserId = String(data.authed_user?.id ?? "");
  if (!SLACK_ID_RE.test(teamId) || !SLACK_ID_RE.test(slackUserId)) throw new Error("no_user");
  return {
    webhookUrl: hook.url,
    channel: String(hook.channel ?? "").replace(/^#/, "").slice(0, 80) || "channel",
    channelId: hook.channel_id ?? null,
    configurationUrl: hook.configuration_url ?? null,
    teamId,
    teamName: String(data.team?.name ?? "").slice(0, 80) || "Slack",
    slackUserId,
    botToken: typeof data.access_token === "string" ? data.access_token : null,
  };
}

interface UsersInfoResponse {
  ok?: boolean;
  user?: { name?: string; real_name?: string; profile?: { display_name?: string; real_name?: string; image_72?: string } };
}

/** The signing-in user's name + avatar via users.info. Falls back to a generic name; never throws. */
export async function fetchSlackProfile(botToken: string | null, slackUserId: string): Promise<SlackProfile> {
  const fallback: SlackProfile = { name: "Slack user", avatar: null };
  if (!botToken) return fallback;
  try {
    const res = await fetch(`${USERS_INFO_URL}?user=${encodeURIComponent(slackUserId)}`, {
      headers: { authorization: `Bearer ${botToken}` },
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    const data = (await res.json()) as UsersInfoResponse;
    if (!res.ok || !data.ok || !data.user) return fallback;
    const p = data.user.profile ?? {};
    const name = (p.display_name || p.real_name || data.user.real_name || data.user.name || fallback.name).slice(0, 80);
    const avatar = typeof p.image_72 === "string" && p.image_72.startsWith("https://") ? p.image_72.slice(0, 500) : null;
    return { name, avatar };
  } catch (e) {
    console.error("[slack-oauth] users.info failed:", (e as Error).message);
    return fallback;
  }
}
