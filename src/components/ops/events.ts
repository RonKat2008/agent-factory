// Pure helpers: parse the eve NDJSON stream and fold events into a chat transcript.
export type ToolStatus = "running" | "waiting" | "done" | "error";
export type ApprovalStatus = "pending" | "sending" | "approved" | "denied";

export type ChatItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string; done: boolean }
  | { kind: "tool"; id: string; name: string; status: ToolStatus; args: string; result?: string; summary?: string; startedAt?: number; ms?: number }
  | { kind: "approval"; id: string; callId?: string; toolName: string; input: Record<string, unknown>; prompt: string; status: ApprovalStatus; decidedAt?: number }
  | { kind: "error"; id: string; text: string; retryUntil?: number; retryable?: boolean };

export type EveEvent = { type: string; data?: Record<string, unknown>; meta?: { at?: string } };
export type StreamSignal = "continue" | "awaiting-input" | "done";

const PREVIEW_MAX = 2000;
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const at = (ev: EveEvent): number => (ev.meta?.at ? Date.parse(ev.meta.at) || Date.now() : Date.now());

export function preview(v: unknown): string {
  let s: string;
  try { s = JSON.stringify(v, null, 2) ?? ""; } catch { s = String(v); }
  return s.length > PREVIEW_MAX ? `${s.slice(0, PREVIEW_MAX)}\n…` : s;
}

/** "4 agents", "12 events": a short human summary of a tool result. */
function summarize(output: unknown): string {
  const o = rec(output);
  if (Array.isArray(output)) return `${output.length} items`;
  if (typeof o.count === "number") {
    const noun = Array.isArray(o.agents) ? "agents" : Array.isArray(o.events) ? "events" : "items";
    return `${o.count} ${o.count === 1 ? noun.replace(/s$/, "") : noun}`;
  }
  return "";
}

/** Splits an NDJSON chunk stream into events; returns the unparsed remainder. */
export function parseLines(buffer: string): { events: EveEvent[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const events: EveEvent[] = [];
  for (const line of parts) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line) as EveEvent;
      if (typeof ev?.type === "string") events.push(ev);
    } catch {
      /* ignore a malformed line */
    }
  }
  return { events, rest };
}

export function signalOf(ev: EveEvent): StreamSignal {
  switch (ev.type) {
    case "session.waiting":
    case "session.failed":
    case "session.completed":
      return "done";
    case "turn.waiting":
      return rec(ev.data).on === "input" ? "awaiting-input" : "continue";
    default:
      return "continue";
  }
}

const upsert = (items: ChatItem[], next: ChatItem): ChatItem[] =>
  items.some((i) => i.id === next.id) ? items.map((i) => (i.id === next.id ? next : i)) : [...items, next];

const patch = (items: ChatItem[], id: string, fn: (i: ChatItem) => ChatItem): ChatItem[] =>
  items.map((i) => (i.id === id ? fn(i) : i));

export function applyEvent(items: ChatItem[], ev: EveEvent): ChatItem[] {
  const d = rec(ev.data);
  const stepKey = `a:${str(d.turnId)}:${String(d.stepIndex ?? 0)}`;
  switch (ev.type) {
    case "message.appended": {
      const delta = str(d.messageDelta);
      const cur = items.find((i) => i.id === stepKey);
      return cur?.kind === "assistant"
        ? patch(items, stepKey, (i) => (i.kind === "assistant" ? { ...i, text: i.text + delta } : i))
        : [...items, { kind: "assistant", id: stepKey, text: delta, done: false }];
    }
    case "message.completed":
      return d.message ? upsert(items, { kind: "assistant", id: stepKey, text: str(d.message), done: true }) : items;
    case "actions.requested": {
      let next = items;
      for (const a of Array.isArray(d.actions) ? d.actions : []) {
        const action = rec(a);
        if (action.kind !== "tool-call") continue;
        const id = `t:${str(action.callId)}`;
        if (!next.some((i) => i.id === id)) {
          next = [...next, { kind: "tool", id, name: str(action.toolName), status: "running", args: preview(action.input), startedAt: at(ev) }];
        }
      }
      return next;
    }
    case "action.result": {
      const r = rec(d.result);
      const id = `t:${str(r.callId)}`;
      const end = at(ev);
      return patch(items, id, (i) =>
        i.kind === "tool"
          ? { ...i, status: r.isError ? "error" : "done", result: preview(r.output), summary: r.isError ? "failed" : summarize(r.output), ms: i.startedAt ? Math.max(0, end - i.startedAt) : undefined }
          : i,
      );
    }
    case "input.requested": {
      let next = items;
      for (const q of Array.isArray(d.requests) ? d.requests : []) {
        const req = rec(q);
        if (req.kind !== "tool-approval") continue;
        const action = rec(req.action);
        const callId = str(action.callId);
        next = upsert(next, { kind: "approval", id: `p:${str(req.requestId)}`, callId, toolName: str(action.toolName), input: rec(action.input), prompt: str(req.prompt), status: "pending" });
        next = patch(next, `t:${callId}`, (i) => (i.kind === "tool" ? { ...i, status: "waiting" } : i));
      }
      return next;
    }
    case "input.resolved": {
      let next = items;
      for (const r of Array.isArray(d.resolutions) ? d.resolutions : []) {
        const res = rec(r);
        const status: ApprovalStatus = res.outcome === "denied" || res.outcome === "cancelled" ? "denied" : "approved";
        next = patch(next, `p:${str(res.requestId)}`, (i) => (i.kind === "approval" ? { ...i, status, decidedAt: i.decidedAt ?? at(ev) } : i));
      }
      return next;
    }
    case "turn.completed":
    case "turn.cancelled":
      return items.map((i) => (i.kind === "assistant" && !i.done ? { ...i, done: true } : i));
    case "turn.failed":
    case "step.failed":
    case "session.failed": {
      const e = rec(d.error ?? d);
      return [...items, { kind: "error", id: `e:${items.length}:${Date.now()}`, text: str(e.message) || "Fleet Ops hit an error.", retryable: true }];
    }
    default:
      return items;
  }
}
