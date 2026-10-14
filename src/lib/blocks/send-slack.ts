import { fail, ok, type BlockRunner } from "./types";

export const sendSlack: BlockRunner = async (params, ctx) => {
  const message = typeof params?.message === "string" ? params.message : "";
  if (!message.trim() && params?.skipIfEmpty) return ok({ sent: false, skipped: true });
  if (ctx.dryRun) return ok({ sent: false, skipped: false, wouldSend: message });
  const r = await ctx.deliver(message);
  if (r.error) return fail(`send_slack failed: ${r.error}`);
  return ok({ sent: r.sent, skipped: false });
};
