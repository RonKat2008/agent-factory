import { CronExpressionParser } from "cron-parser";

/** Next fire time (UTC) of a 5-field cron expression after `from`. Falls back to +1h on a bad expression. */
export function nextRunAt(cron: string, from: Date = new Date()): Date {
  try {
    return CronExpressionParser.parse(cron, { currentDate: from, tz: "UTC" }).next().toDate();
  } catch {
    return new Date(from.getTime() + 60 * 60 * 1000);
  }
}
