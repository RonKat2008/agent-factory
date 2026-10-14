// Fleet knowledge graph: entities the agents have posted about, and who mentioned them.
import { generateText, Output } from "ai";
import { z } from "zod";
import { callCostUsd, fastModel, isDemoMode } from "@/lib/ai";
import { query } from "@/lib/db";

export const ENTITY_KINDS = ["company", "product", "release", "person", "topic"] as const;
const MAX_ENTITIES = 8;
const EXTRACT_TIMEOUT_MS = 5_000;
const MAX_MESSAGE_CHARS = 6_000;
const SNIPPET_CHARS = 220;

const ExtractSchema = z.object({
  entities: z
    .array(
      z.object({
        name: z.string().describe("Canonical short name, e.g. 'Acme' or 'Next.js 16'"),
        kind: z.enum(ENTITY_KINDS),
        url: z.string().optional().describe("A URL for this entity copied verbatim from the message, if any"),
      }),
    )
    .max(MAX_ENTITIES),
});
type Extracted = z.infer<typeof ExtractSchema>["entities"][number];

/** Lower-cased, trimmed, punctuation stripped, whitespace collapsed. */
export function canonicalKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMessage(message: string): string {
  return message
    .split("\n")
    .filter((l) => !l.includes("/f/")) // feedback-link footer
    .join("\n")
    .slice(0, MAX_MESSAGE_CHARS);
}

function snippetFor(message: string, name: string): { snippet: string; url: string | null } {
  const lines = message.split("\n").filter((l) => l.trim());
  const line = lines.find((l) => l.toLowerCase().includes(name.toLowerCase())) ?? lines[0] ?? "";
  const url = line.match(/https?:\/\/[^\s|>)]+/)?.[0] ?? null;
  const snippet = line
    .replace(/<(https?:[^|>]+)\|([^>]*)>/g, "$2")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^[•\-*\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SNIPPET_CHARS);
  return { snippet, url };
}

async function extractEntities(message: string, timeoutMs: number): Promise<Extracted[]> {
  const system =
    "Extract the key named entities (companies, products, releases/versions, people, notable topics) from an automated agent's posted message. " +
    `Return at most ${MAX_ENTITIES}, most important first. Use short canonical names. Do not invent entities that are not in the text. Skip generic words and the posting agent's own name.`;
  const r = await generateText({
    model: fastModel(),
    system,
    prompt: message,
    output: Output.object({ schema: ExtractSchema }),
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
  void callCostUsd(r);
  return r.output.entities;
}

type StoreArgs = { agentId: string; runId: string | null; message: string; at?: string | null; timeoutMs?: number };

async function storeEntity(e: Extracted, a: StoreArgs, message: string): Promise<void> {
  const key = canonicalKey(e.name);
  if (!key) return;
  const at = a.at ?? new Date().toISOString();
  const { snippet, url } = snippetFor(message, e.name);
  const rows = await query<{ id: string }>(
    `insert into kg_entities (key, name, kind, first_seen, last_seen, mentions)
     values ($1, $2, $3, $4, $4, 1)
     on conflict (key) do update set
       last_seen = greatest(kg_entities.last_seen, excluded.last_seen),
       first_seen = least(kg_entities.first_seen, excluded.first_seen),
       mentions = kg_entities.mentions + 1
     returning id`,
    [key, e.name.trim().slice(0, 120), e.kind, at],
  );
  await query(
    `insert into kg_mentions (entity_id, agent_id, run_id, url, snippet, created_at) values ($1, $2, $3, $4, $5, $6)`,
    [rows[0].id, a.agentId, a.runId, e.url?.startsWith("http") ? e.url : url, snippet, at],
  );
}

/** Extracts entities from a posted message and records them. Never throws; gives up after ~5s. */
export async function extractAndStore(a: StoreArgs): Promise<{ stored: number }> {
  const timeoutMs = a.timeoutMs ?? EXTRACT_TIMEOUT_MS;
  try {
    if (isDemoMode() || !a.message.trim()) return { stored: 0 };
    const message = cleanMessage(a.message);
    const work = async () => {
      const seen = new Set<string>();
      const entities = (await extractEntities(message, timeoutMs)).filter((e) => {
        const k = canonicalKey(e.name);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      await Promise.all(entities.slice(0, MAX_ENTITIES).map((e) => storeEntity(e, a, message)));
      return entities.length;
    };
    const stored = await Promise.race([
      work(),
      new Promise<number>((resolve) => setTimeout(() => resolve(0), timeoutMs + 500)),
    ]);
    return { stored };
  } catch (e) {
    console.error("[knowledge] extractAndStore failed:", (e as Error).message);
    return { stored: 0 };
  }
}

export type KnowledgeEntity = { id: string; name: string; kind: string; mentions: number; lastSeen: string; agentIds: string[] };

export async function listKnowledge({ limit = 60 }: { limit?: number } = {}): Promise<{ entities: KnowledgeEntity[] }> {
  const rows = await query<{ id: string; name: string; kind: string; mentions: number; last_seen: string; agent_ids: string[] | null }>(
    `select e.id, e.name, e.kind, e.mentions, e.last_seen,
            (select coalesce(array_agg(distinct m.agent_id::text), '{}') from kg_mentions m
              where m.entity_id = e.id and m.agent_id is not null) as agent_ids
       from kg_entities e
      order by e.mentions desc, e.last_seen desc
      limit $1`,
    [Math.max(1, Math.min(limit, 500))],
  );
  return {
    entities: rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      mentions: Number(r.mentions),
      lastSeen: new Date(r.last_seen).toISOString(),
      agentIds: r.agent_ids ?? [],
    })),
  };
}

export type RecallItem = { title: string; url: string; summary: string };

function queryTerms(q: string): string[] {
  const words = canonicalKey(q).split(" ").filter((w) => w.length >= 3);
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 6);
}

/** What the fleet already knows about `q`: entities matching by key/name, plus recent mentions whose snippet matches. */
export async function recallKnowledge(q: string, limit = 5): Promise<RecallItem[]> {
  const full = canonicalKey(q);
  const terms = queryTerms(q);
  if (!full) return [];
  const patterns = [...new Set([full, ...terms])].map((t) => `%${t.replace(/[%_\\]/g, "\\$&")}%`);
  const rows = await query<{
    name: string; mentions: number; last_seen: string; snippet: string | null; url: string | null; agents: string[] | null;
  }>(
    `select e.name, e.mentions, e.last_seen,
            (select m.snippet from kg_mentions m where m.entity_id = e.id order by m.created_at desc limit 1) as snippet,
            (select m.url from kg_mentions m where m.entity_id = e.id and m.url is not null order by m.created_at desc limit 1) as url,
            (select array_agg(distinct a.name) from kg_mentions m join agents a on a.id = m.agent_id where m.entity_id = e.id) as agents
       from kg_entities e
      where e.key ilike any ($1::text[]) or e.name ilike any ($1::text[])
         or exists (select 1 from kg_mentions m where m.entity_id = e.id and m.snippet ilike any ($1::text[])
                      and m.created_at > now() - interval '14 days')
      order by (e.key = $2) desc, e.mentions desc, e.last_seen desc
      limit $3`,
    [patterns, full, Math.max(1, Math.min(limit, 20))],
  );
  return rows.map((r) => {
    const n = Number(r.mentions);
    const date = new Date(r.last_seen).toISOString().slice(0, 10);
    const who = (r.agents ?? []).join(", ") || "the fleet";
    return {
      title: r.name,
      url: r.url ?? "",
      summary: `mentioned ${n}× by ${who}, last ${date}${r.snippet ? `: ${r.snippet}` : ""}`,
    };
  });
}

/** Runs extraction over the most recent outbox messages (skipping runs already extracted). */
export async function backfillKnowledge(limit = 40): Promise<{ scanned: number; extracted: number }> {
  const rows = await query<{ agent_id: string; run_id: string | null; body: string; created_at: string }>(
    `select o.agent_id, o.run_id, o.body, o.created_at from outbox o
      where o.agent_id is not null and o.run_id is not null and o.sent_ok
        and not exists (select 1 from kg_mentions m where m.run_id = o.run_id)
      order by o.created_at desc limit $1`,
    [limit],
  );
  let extracted = 0;
  const queue = [...rows];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const res = await extractAndStore({
        agentId: r.agent_id,
        runId: r.run_id,
        message: r.body,
        at: new Date(r.created_at).toISOString(),
        timeoutMs: 15_000,
      });
      extracted += res.stored;
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return { scanned: rows.length, extracted };
}
