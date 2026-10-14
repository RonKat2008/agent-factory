// Server-only crypto helpers: AES-256-GCM for stored connection secrets, HMAC for the admin session cookie.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;

/** 32-byte key from CONNECTIONS_KEY, or derived from ADMIN_KEY (SHA-256) when that is absent. */
function encryptionKey(): Buffer {
  const explicit = process.env.CONNECTIONS_KEY;
  if (explicit) return createHash("sha256").update(explicit).digest();
  const admin = process.env.ADMIN_KEY;
  if (!admin) throw new Error("CONNECTIONS_KEY (or ADMIN_KEY) must be set to store connection secrets");
  return createHash("sha256").update(`agent-factory:connections:${admin}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(enc: string): string {
  const [version, iv, tag, ct] = enc.split(":");
  if (version !== VERSION || !iv || !tag || !ct) throw new Error("unrecognized secret format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

/** Constant-time string equality (hashes first so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Cookie value proving the holder knew ADMIN_KEY. Never contains the key itself. */
export function adminSessionToken(): string | null {
  const admin = process.env.ADMIN_KEY;
  if (!admin) return null;
  return createHmac("sha256", admin).update("agent-factory:admin-session:v1").digest("base64url");
}
