// Admin gate for management routes: an httpOnly cookie holding an HMAC of ADMIN_KEY.
import type { NextRequest } from "next/server";
import { adminSessionToken, safeEqual } from "./crypto";

export const ADMIN_COOKIE = "af_admin";
export const ADMIN_COOKIE_MAX_AGE_S = 60 * 60 * 12;

export function isAdminSession(request: NextRequest): boolean {
  const expected = adminSessionToken();
  const got = request.cookies.get(ADMIN_COOKIE)?.value;
  return !!expected && !!got && safeEqual(got, expected);
}

export function checkAdminKey(key: string): boolean {
  const admin = process.env.ADMIN_KEY;
  return !!admin && safeEqual(key, admin);
}

export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
