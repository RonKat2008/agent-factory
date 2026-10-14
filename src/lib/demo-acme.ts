// Acme: a fake competitor SaaS served by this app, used to break and repair the Competitor watcher.
import { demoGet, demoSet } from "@/lib/repo";

export type AcmeEntry = { date: string; title: string; body: string; tag: "New" | "Improved" | "Fixed" };
export type AcmeState = { broken: boolean; published: number };

const ACME_KEY = "acme";
const DEFAULT_STATE: AcmeState = { broken: false, published: 0 };

/** Newest first. */
export const baseEntries: AcmeEntry[] = [
  { date: "2026-10-09", title: "Scheduled exports to S3 and GCS", body: "Send any report to your own bucket on a schedule, as CSV or Parquet, with per-export retention rules.", tag: "New" },
  { date: "2026-10-02", title: "SAML SSO on the Team plan", body: "Single sign-on with Okta, Entra ID and Google Workspace is now available on Team, not just Enterprise.", tag: "Improved" },
  { date: "2026-09-24", title: "Audit log API", body: "Stream every workspace change to your SIEM through a paginated REST endpoint with 400 days of history.", tag: "New" },
  { date: "2026-09-16", title: "Dashboards load twice as fast", body: "A new query cache cuts median dashboard load time from 1.8s to 0.9s for workspaces with over 1M events.", tag: "Improved" },
  { date: "2026-09-08", title: "Usage-based billing alerts", body: "Set spend thresholds per project and get notified by email or Slack before an invoice surprises you.", tag: "New" },
  { date: "2026-08-29", title: "Fixed timezone drift in weekly reports", body: "Weekly digests now respect the workspace timezone instead of UTC, so Monday reports arrive on Monday.", tag: "Fixed" },
];

/** Published one at a time by POST /api/demo/publish, oldest-to-publish first. */
export const extraEntries: AcmeEntry[] = [
  { date: "2026-10-14", title: "AI anomaly detection for metrics", body: "Acme now flags unusual spikes and drops in any metric automatically and explains the likely cause in plain English.", tag: "New" },
  { date: "2026-10-15", title: "Public status page integration", body: "Embed live Acme uptime and incident history on your own status page with a single script tag.", tag: "New" },
  { date: "2026-10-16", title: "Price change: Pro plan now $49 per seat", body: "The Pro plan moves from $39 to $49 per seat per month and now includes unlimited dashboards and SSO.", tag: "Improved" },
  { date: "2026-10-17", title: "Mobile app for iOS and Android", body: "View dashboards, acknowledge alerts and share reports from your phone, with Face ID sign-in.", tag: "New" },
];

export async function getAcmeState(): Promise<AcmeState> {
  const raw = (await demoGet(ACME_KEY)) as Partial<AcmeState> | null;
  return { broken: raw?.broken === true, published: typeof raw?.published === "number" ? raw.published : 0 };
}

export async function setAcmeState(patch: Partial<AcmeState>): Promise<AcmeState> {
  const next = { ...(await getAcmeState()), ...patch };
  await demoSet(ACME_KEY, next);
  return next;
}

export const resetAcmeState = () => setAcmeState(DEFAULT_STATE);

/** Entries visible right now, newest first. */
export function visibleEntries(state: AcmeState): AcmeEntry[] {
  const published = extraEntries.slice(0, Math.min(state.published, extraEntries.length)).reverse();
  return [...published, ...baseEntries];
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Admin routes: ?key=$ADMIN_KEY. */
export function isAdmin(request: Request): boolean {
  const key = process.env.ADMIN_KEY;
  return !!key && new URL(request.url).searchParams.get("key") === key;
}
