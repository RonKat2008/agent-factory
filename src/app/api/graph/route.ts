import { guard, json } from "@/lib/api-util";
import { listCustomConnectors } from "@/lib/repo-connectors";
import { listKnowledge } from "@/lib/knowledge";
import { listTriggers } from "@/lib/repo-triggers";
import { getActiveVersion, listAgents, listEvents } from "@/lib/repo";
import { edgeId, type GraphEdgeDto, type GraphNodeDto, type GraphPulseDto, type GraphResponse } from "@/components/graph/types";

export const dynamic = "force-dynamic";

type Trigger = { fromAgentId: string; toAgentId: string; when: "posted" };
type Knowledge = { entities: { id: string; name: string; kind: string; mentions: number; lastSeen: string; agentIds: string[] }[] };

const PULSE_WINDOW_MS = 2 * 60 * 1000;
const ENTITY_LIMIT = 60;

/** Built-in blocks that talk to an external service, shown as connector nodes. */
const BUILTIN_CONNECTORS: Record<string, { slug: string; label: string }> = {
  hn_search: { slug: "hacker-news", label: "Hacker News" },
  fetch_rss: { slug: "rss", label: "RSS" },
  fetch_url: { slug: "web", label: "Web fetch" },
  github_issues: { slug: "github", label: "GitHub" },
  send_slack: { slug: "slack", label: "Slack" },
};

async function loadTriggers(): Promise<Trigger[]> {
  try {
    return await listTriggers();
  } catch {
    return [];
  }
}

async function loadKnowledge(): Promise<Knowledge> {
  try {
    return await listKnowledge({ limit: ENTITY_LIMIT });
  } catch {
    return { entities: [] };
  }
}

async function loadEvents() {
  try {
    return await listEvents({ limit: 50 });
  } catch {
    return [];
  }
}

export function GET(): Promise<Response> {
  return guard("GET /api/graph", async () => {
    const [agents, triggers, knowledge, custom, events] = await Promise.all([
      listAgents(),
      loadTriggers(),
      loadKnowledge(),
      listCustomConnectors().catch(() => []),
      loadEvents(),
    ]);
    const specs = await Promise.all(agents.map((a) => getActiveVersion(a.id).catch(() => null)));

    const nodes: GraphNodeDto[] = [];
    const edges: GraphEdgeDto[] = [];
    const agentIds = new Set(agents.map((a) => a.id));
    const usesCount = new Map<string, Map<string, number>>(); // connector node id -> agentId -> count

    const customBySlug = new Map(custom.map((c) => [c.slug, c]));
    const connectorNodes = new Map<string, GraphNodeDto>();
    for (const c of custom) {
      connectorNodes.set(`connector:${c.slug}`, {
        id: `connector:${c.slug}`,
        type: "connector",
        label: c.name,
        kind: c.kind,
        weight: 1,
        meta: { slug: c.slug },
      });
    }

    agents.forEach((a, i) => {
      for (const step of specs[i]?.spec.steps ?? []) {
        let nodeId: string | null = null;
        if (step.block === "connector") {
          const slug = step.params.connector;
          nodeId = `connector:${slug}`;
          if (!connectorNodes.has(nodeId)) {
            const known = customBySlug.get(slug);
            connectorNodes.set(nodeId, { id: nodeId, type: "connector", label: known?.name ?? slug, kind: known?.kind, weight: 1, meta: { slug } });
          }
        } else if (BUILTIN_CONNECTORS[step.block]) {
          const b = BUILTIN_CONNECTORS[step.block];
          nodeId = `connector:${b.slug}`;
          if (!connectorNodes.has(nodeId)) {
            connectorNodes.set(nodeId, { id: nodeId, type: "connector", label: b.label, kind: "built-in", weight: 1, meta: { slug: b.slug, builtin: true } });
          }
        }
        if (!nodeId) continue;
        const per = usesCount.get(nodeId) ?? new Map<string, number>();
        per.set(a.id, (per.get(a.id) ?? 0) + 1);
        usesCount.set(nodeId, per);
      }
    });

    agents.forEach((a, i) => {
      nodes.push({
        id: a.id,
        type: "agent",
        label: a.name,
        status: a.status,
        weight: Math.max(1, a.runs),
        meta: {
          version: a.currentVersion ?? specs[i]?.version ?? null,
          lastRunAt: a.lastRunAt,
          lastOutput: a.lastOutput?.message ?? null,
          health: a.health,
          schedule: a.scheduleHuman,
        },
      });
    });

    for (const t of triggers) {
      if (!agentIds.has(t.fromAgentId) || !agentIds.has(t.toAgentId)) continue;
      edges.push({ source: t.fromAgentId, target: t.toAgentId, type: "trigger", weight: 1 });
    }

    for (const [nodeId, per] of usesCount) {
      const node = connectorNodes.get(nodeId);
      if (!node) continue;
      node.weight = per.size;
      for (const [agentId, n] of per) edges.push({ source: agentId, target: nodeId, type: "uses", weight: n });
    }
    // Custom connectors nobody uses yet still appear (unlinked), so the catalog is visible.
    for (const node of connectorNodes.values()) nodes.push(node);

    for (const e of knowledge.entities) {
      const id = `entity:${e.id}`;
      nodes.push({ id, type: "entity", label: e.name, kind: e.kind, weight: Math.max(1, e.mentions), meta: { lastSeen: e.lastSeen } });
      for (const agentId of e.agentIds) {
        if (agentIds.has(agentId)) edges.push({ source: agentId, target: id, type: "mention", weight: 1 });
      }
    }

    const now = Date.now();
    const pulses: GraphPulseDto[] = [];
    for (const ev of events) {
      if ((ev.type as string) !== "triggered" || !ev.agentId) continue;
      if (now - new Date(ev.createdAt).getTime() > PULSE_WINDOW_MS) continue;
      const from = typeof ev.data?.fromAgentId === "string" ? ev.data.fromAgentId : null;
      for (const t of triggers) {
        if (t.toAgentId !== ev.agentId || (from && t.fromAgentId !== from)) continue;
        pulses.push({ edgeId: edgeId({ source: t.fromAgentId, target: t.toAgentId, type: "trigger" }), at: ev.createdAt });
      }
    }

    const body: GraphResponse = { nodes, edges, pulses };
    return json(body);
  });
}
