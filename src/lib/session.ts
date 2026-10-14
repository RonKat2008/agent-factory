// "Sign in with Slack" session: a signed, httpOnly `af_session` cookie (30 days). No server-side session table.
// Payload holds only public profile bits; the user id is "slack:<team_id>:<user_id>".
import { cookies } from "next/headers";
import { signToken, verifyToken } from "./signed-token";

export const SESSION_COOKIE = "af_session";
const SESSION_LABEL = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  uid: string; // "slack:T…:U…"
  slackUserId: string;
  teamId: string;
  team: string;
  name: string;
  avatar: string | null;
}

export function slackUserKey(teamId: string, slackUserId: string): string {
  return `slack:${teamId}:${slackUserId}`;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  const s = verifyToken<SessionUser>(SESSION_LABEL, raw);
  if (!s || typeof s.uid !== "string" || !s.uid.startsWith("slack:")) return null;
  return { uid: s.uid, slackUserId: s.slackUserId, teamId: s.teamId, team: s.team, name: s.name, avatar: s.avatar ?? null };
}

/** Route handlers only. */
export async function setSessionCookie(user: SessionUser): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, signToken(SESSION_LABEL, user, SESSION_TTL_MS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
