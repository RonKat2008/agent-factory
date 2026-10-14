import { defineSchedule } from "eve/schedules";

// 16:00 UTC = 9am PT (PDT). Vercel Cron evaluates in UTC.
export default defineSchedule({
  cron: "0 16 * * *",
  markdown: `Write the daily Agent Factory fleet health report.

1. Call fleet_stats and list_agents.
2. Call fleet_feed with sinceHours: 24 to find failures, self-fixes/repairs, edits, and pending approvals in the last 24h.
3. For any agent that failed, was repaired, is paused, has health below 80, or is waiting on a human, call get_agent for detail.

Format a terse Slack mrkdwn report:
- Headline: agents live, runs today, auto-repairs, total cost.
- Failures (24h): agent name, version, one-line cause, link.
- Repairs (24h): agent name, old -> new version, reason, link.
- Needs a human: pending approvals, paused or unhealthy agents, proposed versions awaiting accept/reject, with links.
Say "none" for empty sections.

Then call post_slack with the report. If it returns posted: false, just return the report as your reply.`,
});
