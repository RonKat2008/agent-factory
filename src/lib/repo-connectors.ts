// Custom connectors (HTTP API or remote MCP server) added from /connections by anyone.
// All SQL for the custom_connectors table lives here. Secrets are stored encrypted and never
// leave this module except through getConnectorSecret() (server-only, used at call time).
import { query } from "./db";
import { decryptSecret } from "./crypto";

export type ConnectorKind = "http" | "mcp";
export type ParamLocation = "path" | "query" | "body";

export interface ConnectorParam {
  name: string;
  description: string;
  in: ParamLocation;
  required: boolean;
}

export interface ConnectorAction {
  name: string;
  description: string;
  method?: "GET" | "POST"; // http only
  path?: string; // http only, may contain {param} and a fixed ?query
  params: ConnectorParam[];
  inputSchema?: unknown; // mcp only: the tool's JSON schema
}

/** Public shape: never includes the secret. */
export interface CustomConnector {
  id: string;
  slug: string;
  kind: ConnectorKind;
  name: string;
  baseUrl: string;
  authHeader: string | null;
  hasSecret: boolean;
  actions: ConnectorAction[];
  createdAt: string;
}

type Row = {
  id: string;
  slug: string;
  kind: ConnectorKind;
  name: string;
  base_url: string;
  auth_header: string | null;
  secret_enc: string | null;
  actions: ConnectorAction[] | null;
  created_at: string;
  created_by_ip: string | null;
};

const COLS = "id, slug, kind, name, base_url, auth_header, secret_enc, actions, created_at, created_by_ip";

function toConnector(r: Row): CustomConnector {
  return {
    id: r.id,
    slug: r.slug,
    kind: r.kind,
    name: r.name,
    baseUrl: r.base_url,
    authHeader: r.auth_header,
    hasSecret: !!r.secret_enc,
    actions: Array.isArray(r.actions) ? r.actions : [],
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function listCustomConnectors(): Promise<(CustomConnector & { createdByIp: string | null })[]> {
  const rows = await query<Row>(`select ${COLS} from custom_connectors order by created_at desc limit 100`);
  return rows.map((r) => ({ ...toConnector(r), createdByIp: r.created_by_ip }));
}

export async function getCustomConnector(slug: string): Promise<(CustomConnector & { createdByIp: string | null }) | null> {
  const rows = await query<Row>(`select ${COLS} from custom_connectors where slug = $1`, [slug]);
  return rows[0] ? { ...toConnector(rows[0]), createdByIp: rows[0].created_by_ip } : null;
}

/** Decrypted auth secret for a connector (server-only), or null. */
export async function getConnectorSecret(slug: string): Promise<string | null> {
  const rows = await query<{ secret_enc: string | null }>("select secret_enc from custom_connectors where slug = $1", [slug]);
  const enc = rows[0]?.secret_enc;
  return enc ? decryptSecret(enc) : null;
}

export async function countCustomConnectors(): Promise<number> {
  const rows = await query<{ n: number }>("select count(*)::int as n from custom_connectors");
  return rows[0]?.n ?? 0;
}

export async function slugTaken(slug: string): Promise<boolean> {
  const rows = await query<{ one: number }>("select 1 as one from custom_connectors where slug = $1", [slug]);
  return rows.length > 0;
}

export interface NewConnector {
  slug: string;
  kind: ConnectorKind;
  name: string;
  baseUrl: string;
  authHeader: string | null;
  secretEnc: string | null;
  actions: ConnectorAction[];
  createdByIp: string;
}

export async function insertCustomConnector(c: NewConnector): Promise<CustomConnector> {
  const rows = await query<Row>(
    `insert into custom_connectors (slug, kind, name, base_url, auth_header, secret_enc, actions, created_by_ip)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) returning ${COLS}`,
    [c.slug, c.kind, c.name, c.baseUrl, c.authHeader, c.secretEnc, JSON.stringify(c.actions), c.createdByIp],
  );
  return toConnector(rows[0]);
}

export async function deleteCustomConnector(slug: string): Promise<boolean> {
  const rows = await query<{ id: string }>("delete from custom_connectors where slug = $1 returning id", [slug]);
  return rows.length > 0;
}
