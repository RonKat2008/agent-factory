import { fail, ok, type BlockRunner, type Item } from "./types";
import { getGithubDefaultRepo, getGithubToken } from "@/lib/connections";

type GhIssue = { number: number; title: string; html_url: string; body?: string | null; created_at?: string; labels?: ({ name?: string } | string)[]; pull_request?: unknown };
const BODY_CAP = 1000;

async function gh(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "user-agent": "agent-factory", "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

export const githubIssues: BlockRunner = async (params, ctx) => {
  const token = await getGithubToken();
  if (!token) return fail("GitHub is not connected; connect it on /connections (or set GITHUB_TOKEN)");
  const repo = String(params?.repo || (await getGithubDefaultRepo()) || "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return fail(`github_issues: repo must be "owner/name", got "${repo}"`);

  if (params?.action === "label") {
    let input = params.input;
    if (typeof input === "string") {
      try { input = JSON.parse(input); } catch { return fail("github_issues label: input is not valid JSON"); }
    }
    if (!Array.isArray(input)) return fail("github_issues label: input must resolve to an array of {number, labels, comment?}");
    const entries = input as { number: number; labels?: string[]; comment?: string }[];
    if (ctx.dryRun) return ok({ applied: 0, wouldApply: entries.length });
    let applied = 0;
    for (const e of entries) {
      if (typeof e?.number !== "number") continue;
      if (e.labels?.length) {
        const r = await gh(`/repos/${repo}/issues/${e.number}/labels`, token, { method: "POST", body: JSON.stringify({ labels: e.labels }) });
        if (!r.ok) return fail(`GitHub HTTP ${r.status} ${r.statusText} labelling ${repo}#${e.number}`);
      }
      if (e.comment) {
        const r = await gh(`/repos/${repo}/issues/${e.number}/comments`, token, { method: "POST", body: JSON.stringify({ body: e.comment }) });
        if (!r.ok) return fail(`GitHub HTTP ${r.status} ${r.statusText} commenting on ${repo}#${e.number}`);
      }
      applied++;
    }
    return ok({ applied });
  }

  const sinceHours = Number(params?.sinceHours) > 0 ? Number(params.sinceHours) : 168;
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const r = await gh(`/repos/${repo}/issues?state=open&since=${encodeURIComponent(since)}&per_page=50`, token);
  if (!r.ok) return fail(`GitHub HTTP ${r.status} ${r.statusText} listing issues for ${repo}`);
  const issues = (await r.json()) as GhIssue[];
  const items: Item[] = issues
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      url: i.html_url,
      body: (i.body ?? "").slice(0, BODY_CAP),
      labels: (i.labels ?? []).map((l) => (typeof l === "string" ? l : (l.name ?? ""))).filter(Boolean),
      ...(i.created_at ? { publishedAt: i.created_at } : {}),
    }));
  return ok({ items });
};
