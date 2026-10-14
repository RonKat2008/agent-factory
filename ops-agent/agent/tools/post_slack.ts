import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Post a message to the ops Slack channel via incoming webhook (SLACK_WEBHOOK_URL). If no webhook is configured, returns posted: false and you should just return the report as your reply.",
  inputSchema: z.object({ text: z.string().min(1).max(3500).describe("Slack mrkdwn message") }),
  label: { start: () => "Post to Slack" },
  async execute({ text }) {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return { posted: false, reason: "SLACK_WEBHOOK_URL not set" };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Slack webhook failed with HTTP ${res.status}`);
    return { posted: true };
  },
});
