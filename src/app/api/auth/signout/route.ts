// POST /api/auth/signout → clears the Slack session cookie (the anonymous af_uid stays).
import { guard, json } from "@/lib/api-util";
import { clearSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export function POST(): Promise<Response> {
  return guard("POST /api/auth/signout", async () => {
    await clearSessionCookie();
    return json({ user: null });
  });
}
