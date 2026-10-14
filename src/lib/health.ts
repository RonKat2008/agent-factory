import { query } from "@/lib/db";

export async function getHealth(): Promise<{ ok: boolean; db: boolean; dbError?: string }> {
  try {
    await query("select 1");
    return { ok: true, db: true };
  } catch (err) {
    return { ok: true, db: false, dbError: err instanceof Error ? err.message : String(err) };
  }
}
