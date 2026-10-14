// BotID server check. Only enforced on Vercel; local dev never calls it.
import { checkBotId } from "botid/server";
import { jsonError } from "@/lib/api-util";

/** Returns a 403 response for bot traffic, else null. */
export async function blockBots(): Promise<Response | null> {
  if (!process.env.VERCEL) return null;
  const v = await checkBotId();
  return v.isBot && !v.isVerifiedBot ? jsonError("Bot traffic blocked", 403) : null;
}
