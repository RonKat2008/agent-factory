// Fetch helpers with an SSRF guard. Blocks only http(s), and refuses local/private hosts
// unless the host is the host of APP_URL (the demo site lives on our own host).

export const FETCH_TIMEOUT_MS = 10_000;
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 AgentFactory/1.0";

function appHost(): string | null {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).host.toLowerCase() : null;
  } catch {
    return null;
  }
}

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (h.includes(":")) {
    return h === "::" || h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
  }
  return false;
}

/** Throws a precise Error when the URL must not be fetched. */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Blocked URL ${raw}: only http(s) is allowed`);
  }
  if (url.host.toLowerCase() === appHost()) return url;
  if (isPrivateHostname(url.hostname)) {
    throw new Error(`Blocked URL ${raw}: private/local addresses are not allowed`);
  }
  return url;
}

/** Fetch with timeout, UA, manual redirect following (each hop re-checked by the SSRF guard). */
export async function safeFetch(raw: string, init: RequestInit = {}): Promise<Response> {
  let current = assertSafeUrl(raw).toString();
  for (let hop = 0; hop < 5; hop++) {
    let res: Response;
    try {
      res = await fetch(current, {
        ...init,
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8", ...(init.headers ?? {}) },
      });
    } catch (e) {
      const err = e as Error;
      if (err.name === "TimeoutError" || err.name === "AbortError") throw new Error(`Timeout after ${FETCH_TIMEOUT_MS / 1000}s fetching ${current}`);
      throw new Error(`Network error fetching ${current}: ${err.message}${(err.cause as Error | undefined)?.message ? ` (${(err.cause as Error).message})` : ""}`);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = assertSafeUrl(new URL(res.headers.get("location")!, current).toString()).toString();
      continue;
    }
    return res;
  }
  throw new Error(`Too many redirects fetching ${raw}`);
}
