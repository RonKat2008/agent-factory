// DEMO_MODE: serve canned responses so the live demo survives bad Wi-Fi or API rate limits.

const DEFAULT_CANNED_REPLY =
  "This is a canned DEMO_MODE reply. Replace it in src/lib/demo.ts with a realistic answer from your demo script.";
const STREAM_CHUNK_CHARS = 12;
const STREAM_CHUNK_DELAY_MS = 20;

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** Canned AI replies keyed by feature id. Add one per AI feature in docs/SPEC.md §4. */
export const CANNED_AI_REPLIES: Readonly<Record<string, string>> = {
  default: DEFAULT_CANNED_REPLY,
};

export function cannedReply(feature = "default"): string {
  return CANNED_AI_REPLIES[feature] ?? DEFAULT_CANNED_REPLY;
}

/** Streams text in small chunks so canned replies look like a live model response. */
export function streamText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= text.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(text.slice(offset, offset + STREAM_CHUNK_CHARS)));
      offset += STREAM_CHUNK_CHARS;
      await new Promise((resolve) => setTimeout(resolve, STREAM_CHUNK_DELAY_MS));
    },
  });
}

// ---- Canned outputs for the `llm` block and `llm_judge` test (DEMO_MODE) ----
const CANNED_BULLET_FALLBACK = [
  { text: "Canned demo finding: a notable item from the monitored source", url: "https://example.com/demo-1" },
  { text: "Canned demo finding: a second notable item", url: "https://example.com/demo-2" },
];

/** Canned llm-block output per format; reuses real URLs/lines from the input when present. */
export function cannedLlmOutput(format: "text" | "cited_bullets" | "issue_labels", input: string) {
  if (format === "text") {
    const text = "Canned DEMO_MODE summary of the input.";
    return { text, markdown: text };
  }
  if (format === "issue_labels") {
    const labels = [{ number: 1, labels: ["bug"], comment: "Canned demo triage: looks like a bug." }];
    return { labels, markdown: labels.map((l) => `• #${l.number}: ${l.labels.join(", ")}`).join("\n") };
  }
  const found = [...input.matchAll(/^[-*•]?\s*(.{5,120}?)\s*\((https?:\/\/[^\s)]+)\)/gm)]
    .slice(0, 3)
    .map((m) => ({ text: m[1], url: m[2] }));
  const bullets = found.length > 0 ? found : CANNED_BULLET_FALLBACK;
  return { bullets, markdown: bullets.map((b) => `• ${b.text} — <${b.url}|source>`).join("\n"), empty: false };
}

export const CANNED_JUDGE_RESULT = { pass: true, reason: "DEMO_MODE: canned pass" } as const;
