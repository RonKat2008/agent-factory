// Shared helpers for API routes.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_STORE = { "Cache-Control": "no-store" };

export function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export function json(body: unknown): Response {
  return Response.json(body, { headers: NO_STORE });
}

/** Run a handler, mapping thrown errors to a 500 without leaking stacks. */
export async function guard(label: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[api] ${label} failed:`, err);
    return jsonError(err instanceof Error ? err.message : "internal error", 500);
  }
}
