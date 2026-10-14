// Anonymous visitor identity: a random UUID in an httpOnly `af_uid` cookie (1 year).
// Lets any visitor own agents and connect their own Slack without signing up.
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getSessionUser } from "./session";

export const VISITOR_COOKIE = "af_uid";
const VISITOR_MAX_AGE_S = 60 * 60 * 24 * 365;
const VISITOR_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVisitorId(v: unknown): v is string {
  return typeof v === "string" && VISITOR_RE.test(v);
}

/** The visitor id from the cookie, or null. Read-only (safe anywhere on the server). */
export async function getVisitorId(): Promise<string | null> {
  const v = (await cookies()).get(VISITOR_COOKIE)?.value;
  return isVisitorId(v) ? v : null;
}

/** The visitor id, minting + setting the cookie when absent. Route handlers / server actions only. */
export async function getOrCreateVisitorId(): Promise<string> {
  const existing = await getVisitorId();
  if (existing) return existing;
  const id = randomUUID();
  (await cookies()).set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_MAX_AGE_S,
  });
  return id;
}

/** Every owner id this browser speaks for: the signed-in Slack user (first) and the anonymous af_uid. */
export async function getOwnerIds(): Promise<string[]> {
  const [user, anon] = await Promise.all([getSessionUser(), getVisitorId()]);
  return [user?.uid, anon].filter((v): v is string => !!v);
}

/** The id new agents + connections are stored under: the signed-in user, else the (minted) anonymous id. */
export async function getOrCreateOwnerId(): Promise<string> {
  return (await getSessionUser())?.uid ?? (await getOrCreateVisitorId());
}
