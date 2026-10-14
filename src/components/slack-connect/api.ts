// Client calls for "Sign in with Slack". Secrets never come down: only names, channel and team.
export interface MeUser {
  name: string;
  avatar: string | null;
  team: string;
}
export interface MeSlack {
  channel: string;
  team: string;
}
export interface Me {
  user: MeUser | null;
  slack: MeSlack | null;
  slackOAuth: { configured: boolean };
}

export const ME_CHANGED_EVENT = "af:me-changed";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body;
}

export const getMe = () => call<Me>("/api/me");

function announce(): void {
  window.dispatchEvent(new Event(ME_CHANGED_EVENT));
}

export async function signOut(): Promise<void> {
  await call("/api/auth/signout", { method: "POST" });
  announce();
}

export async function disconnectSlack(): Promise<void> {
  await call("/api/me/connections/slack", { method: "DELETE" });
  announce();
}

/** Where the browser goes to start the Slack consent screen. */
export function slackStartUrl(opts: { agentId?: string | null; returnTo?: string }): string {
  const q = new URLSearchParams();
  if (opts.agentId) q.set("agentId", opts.agentId);
  q.set("return", opts.returnTo ?? currentPath());
  return `/api/slack/oauth/start?${q.toString()}`;
}

/** The current path + query, minus our own ?slack/&reason markers. */
export function currentPath(): string {
  if (typeof window === "undefined") return "/connections";
  const url = new URL(window.location.href);
  url.searchParams.delete("slack");
  url.searchParams.delete("reason");
  return `${url.pathname}${url.search}`;
}
