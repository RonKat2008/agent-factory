// Cost guard for public routes that spend AI / Sandbox / Slack: fixed-window counters in demo_state.
// One atomic upsert per check, so concurrent requests can't race past the limit.
import { query } from "./db";
import { jsonError } from "./api-util";

type Window = { max: number; windowSec: number };

async function hit(bucket: string, w: Window): Promise<boolean> {
  const rows = await query<{ value: { count?: number } }>(
    `insert into demo_state (key, value) values ($1, jsonb_build_object('start', $2::bigint, 'count', 1))
     on conflict (key) do update set value = case
       when (demo_state.value->>'start')::bigint <= $2::bigint - $3::bigint
         then jsonb_build_object('start', $2::bigint, 'count', 1)
       else jsonb_set(demo_state.value, '{count}', to_jsonb(coalesce((demo_state.value->>'count')::int, 0) + 1))
     end
     returning value`,
    [`rl:${bucket}`, Date.now(), w.windowSec * 1000],
  );
  return Number(rows[0]?.value?.count ?? 0) <= w.max;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Returns a 429 response when any limit is exceeded, else null. `perKey` limits are scoped to `key` (an IP or agent id). */
export async function rateLimit(
  name: string,
  limits: { key?: string; perKey?: Window; global: Window },
): Promise<Response | null> {
  if (limits.key && limits.perKey && !(await hit(`${name}:${limits.key}`, limits.perKey))) {
    return jsonError(`Slow down: too many ${name} requests, try again in a minute`, 429);
  }
  if (!(await hit(`${name}:global`, limits.global))) {
    return jsonError(`The public demo hit its ${name} budget for now, try again later`, 429);
  }
  return null;
}
