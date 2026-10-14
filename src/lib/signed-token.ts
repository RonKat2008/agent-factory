// Compact HMAC-signed tokens ("<base64url json>.<base64url mac>") for the OAuth state and the session cookie.
// Secret: SLACK_STATE_SECRET, else derived from ADMIN_KEY, else from SLACK_CLIENT_SECRET. Each use gets its own label.
import { createHash, createHmac } from "node:crypto";
import { safeEqual } from "./crypto";

const MAX_TOKEN_LEN = 4000;

function secretFor(label: string): string | null {
  const base = process.env.SLACK_STATE_SECRET ?? process.env.ADMIN_KEY ?? process.env.SLACK_CLIENT_SECRET;
  return base ? createHash("sha256").update(`agent-factory:${label}:${base}`).digest("hex") : null;
}

export function hasTokenSecret(): boolean {
  return secretFor("probe") !== null;
}

function mac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Signs `data` with an `exp` (epoch ms). Throws when no secret is configured. */
export function signToken<T extends object>(label: string, data: T, ttlMs: number, now = Date.now()): string {
  const secret = secretFor(label);
  if (!secret) throw new Error("No signing secret configured (set SLACK_STATE_SECRET or ADMIN_KEY)");
  const payload = Buffer.from(JSON.stringify({ ...data, exp: now + ttlMs })).toString("base64url");
  return `${payload}.${mac(payload, secret)}`;
}

/** The decoded payload, or null when malformed, signed with another label/secret, tampered or expired. */
export function verifyToken<T extends object>(label: string, token: unknown, now = Date.now()): (T & { exp: number }) | null {
  const secret = secretFor(label);
  if (!secret || typeof token !== "string" || token.length > MAX_TOKEN_LEN) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!safeEqual(parts[1], mac(parts[0], secret))) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as T & { exp: number };
    if (!data || typeof data !== "object" || typeof data.exp !== "number" || data.exp < now) return null;
    return data;
  } catch {
    return null;
  }
}
