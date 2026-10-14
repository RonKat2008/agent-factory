import { invokeConnector } from "@/lib/connectors";
import { fail, ok, type BlockRunner } from "./types";

type Arg = { name?: unknown; value?: unknown };

/** Accepts the spec's [{name, value}] array (or a plain record) and returns a record of resolved args. */
function toArgs(raw: unknown): Record<string, unknown> {
  if (Array.isArray(raw)) {
    return Object.fromEntries((raw as Arg[]).filter((a) => a && typeof a.name === "string" && a.name).map((a) => [a.name as string, a.value]));
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

export const connector: BlockRunner = async (params) => {
  const slug = String(params?.connector ?? "").trim();
  const action = String(params?.action ?? "").trim();
  if (!slug) return fail("connector: missing required param 'connector' (a connector slug)");
  if (!action) return fail(`connector ${slug}: missing required param 'action'`);
  const r = await invokeConnector(slug, action, toArgs(params?.args));
  return r.ok ? ok(r.output) : fail(r.error);
};
