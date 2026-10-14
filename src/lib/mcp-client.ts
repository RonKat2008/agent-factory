// Minimal MCP client over Streamable HTTP (JSON or SSE responses): initialize -> tools/list | tools/call.
// The installed `ai` v7 has no MCP client and @ai-sdk/mcp is not installed, so this speaks JSON-RPC directly.
// Every request goes through the SSRF-guarded safeFetch (10s timeout) and responses are size-capped.
import { safeFetch } from "./net";

const PROTOCOL_VERSION = "2025-06-18";
const MAX_RESPONSE_BYTES = 512 * 1024;

export interface McpTool {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface McpCallResult {
  isError: boolean;
  text: string;
  structured: unknown;
}

type JsonRpcResponse = { jsonrpc: "2.0"; id?: number; result?: unknown; error?: { code: number; message: string } };

/** Reads at most `max` bytes of a response body as text. */
export async function readCapped(res: Response, max = MAX_RESPONSE_BYTES): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: "", truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      chunks.push(value.slice(0, value.byteLength - (size - max)));
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks).toString("utf8"), truncated };
}

/** Reads an SSE stream until the JSON-RPC message with `id` arrives (servers may keep the stream open). */
async function readSseFor(res: Response, id: number): Promise<JsonRpcResponse | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let size = 0;
  try {
    while (size <= MAX_RESPONSE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split(/\r?\n\r?\n/);
      buf = events.pop() ?? "";
      for (const ev of events) {
        const data = ev.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
        if (!data) continue;
        try {
          const msg = JSON.parse(data) as JsonRpcResponse;
          if (msg.id === id) return msg;
        } catch {
          // not JSON; keep reading
        }
      }
    }
    return null;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

class McpSession {
  private nextId = 1;
  private sessionId: string | null = null;

  constructor(private readonly url: string, private readonly token: string | null) {}

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": PROTOCOL_VERSION,
      ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
    };
  }

  private async post(body: unknown): Promise<Response> {
    const res = await safeFetch(this.url, { method: "POST", headers: this.headers(), body: JSON.stringify(body) });
    if (res.status === 401 || res.status === 403) {
      throw new Error(`MCP server rejected the request (${res.status}): ${this.token ? "check the bearer token" : "it needs a bearer token"}`);
    }
    if (res.status === 404 || res.status === 405) {
      throw new Error(`MCP server returned ${res.status}. Only Streamable HTTP servers are supported (use the server's /mcp URL, not a legacy /sse URL)`);
    }
    return res;
  }

  async request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const res = await this.post({ jsonrpc: "2.0", id, method, params });
    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;
    if (!res.ok) {
      const { text } = await readCapped(res, 2000);
      throw new Error(`MCP ${method} failed: HTTP ${res.status}${text ? ` ${text.slice(0, 200)}` : ""}`);
    }
    const type = res.headers.get("content-type") ?? "";
    let msg: JsonRpcResponse | null;
    if (type.includes("text/event-stream")) {
      msg = await readSseFor(res, id);
    } else {
      const { text } = await readCapped(res);
      try {
        msg = JSON.parse(text) as JsonRpcResponse;
      } catch {
        throw new Error(`MCP ${method}: server did not return JSON-RPC (content-type ${type || "none"})`);
      }
    }
    if (!msg) throw new Error(`MCP ${method}: no response from server`);
    if (msg.error) throw new Error(`MCP ${method} error ${msg.error.code}: ${msg.error.message}`);
    return msg.result;
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "agent-factory", version: "1.0" },
    });
    // Best-effort notification; servers reply 202 with no body.
    const res = await this.post({ jsonrpc: "2.0", method: "notifications/initialized" }).catch(() => null);
    await res?.body?.cancel().catch(() => undefined);
  }
}

/** Connects and lists the server's tools. Throws a precise Error on failure. */
export async function mcpListTools(url: string, token: string | null): Promise<McpTool[]> {
  const s = new McpSession(url, token);
  await s.initialize();
  const result = (await s.request("tools/list", {})) as { tools?: { name?: unknown; description?: unknown; inputSchema?: unknown }[] };
  const tools = Array.isArray(result?.tools) ? result.tools : [];
  return tools
    .filter((t) => typeof t.name === "string" && t.name)
    .map((t) => ({ name: String(t.name), description: typeof t.description === "string" ? t.description : "", inputSchema: t.inputSchema ?? { type: "object" } }));
}

/** Connects and calls one tool. Throws a precise Error on transport failure; tool errors come back as isError. */
export async function mcpCallTool(url: string, token: string | null, name: string, args: Record<string, unknown>): Promise<McpCallResult> {
  const s = new McpSession(url, token);
  await s.initialize();
  const result = (await s.request("tools/call", { name, arguments: args })) as {
    content?: { type?: string; text?: string }[];
    structuredContent?: unknown;
    isError?: boolean;
  };
  const text = (result?.content ?? []).filter((c) => c.type === "text" && typeof c.text === "string").map((c) => c.text).join("\n");
  return { isError: !!result?.isError, text, structured: result?.structuredContent ?? null };
}
