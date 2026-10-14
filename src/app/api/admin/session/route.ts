import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE_S, adminCookieOptions, checkAdminKey, isAdminSession } from "@/lib/admin-auth";
import { adminSessionToken } from "@/lib/crypto";

const NO_STORE = { "Cache-Control": "no-store" };
const Body = z.object({ key: z.string().min(1).max(512) });

/** Is this browser unlocked for management? */
export function GET(request: NextRequest) {
  return NextResponse.json({ unlocked: isAdminSession(request) }, { headers: NO_STORE });
}

/** Unlock: { key } must equal ADMIN_KEY. Sets an httpOnly cookie with an HMAC of the key (never the key). */
export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "key is required" }, { status: 400, headers: NO_STORE });
  const token = adminSessionToken();
  if (!token) return NextResponse.json({ error: "ADMIN_KEY is not configured" }, { status: 503, headers: NO_STORE });
  if (!checkAdminKey(parsed.data.key)) return NextResponse.json({ error: "wrong key" }, { status: 401, headers: NO_STORE });
  const res = NextResponse.json({ unlocked: true }, { headers: NO_STORE });
  res.cookies.set(ADMIN_COOKIE, token, adminCookieOptions(ADMIN_COOKIE_MAX_AGE_S));
  return res;
}

/** Lock again. */
export function DELETE() {
  const res = NextResponse.json({ unlocked: false }, { headers: NO_STORE });
  res.cookies.set(ADMIN_COOKIE, "", adminCookieOptions(0));
  return res;
}
