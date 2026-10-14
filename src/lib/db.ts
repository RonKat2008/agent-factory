import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cached: NeonQueryFunction<false, false> | undefined;

/** Lazy Neon client. Never call at module top level (build must work without DATABASE_URL). */
export function getSql(): NeonQueryFunction<false, false> {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add the Neon integration in Vercel and run `vercel env pull`.");
  }
  cached = neon(url);
  return cached;
}

/** Parameterized query helper: query<Row>("select * from agents where id = $1", [id]). */
export async function query<Row = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<Row[]> {
  const rows = await getSql().query(text, params);
  return rows as Row[];
}
