import { CronExpressionParser } from "cron-parser";

/** Floor between scheduled runs: a generated "* * * * *" must not run (and spend) every minute on the public demo. */
const MIN_INTERVAL_MS = 10 * 60 * 1000;
const MAX_ITERATIONS = 100;

/** Next fire time (UTC) of a 5-field cron expression after `from`, at least MIN_INTERVAL_MS away. Falls back to +1h on a bad expression. */
export function nextRunAt(cron: string, from: Date = new Date()): Date {
  try {
    const it = CronExpressionParser.parse(cron, { currentDate: from, tz: "UTC" });
    let next = it.next().toDate();
    for (let i = 0; i < MAX_ITERATIONS && next.getTime() - from.getTime() < MIN_INTERVAL_MS; i++) next = it.next().toDate();
    return next.getTime() - from.getTime() < MIN_INTERVAL_MS ? new Date(from.getTime() + MIN_INTERVAL_MS) : next;
  } catch {
    return new Date(from.getTime() + 60 * 60 * 1000);
  }
}
