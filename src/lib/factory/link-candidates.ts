// Deterministic (no LLM) search for where a dead page moved: crawl the dead URL's parent page,
// the origin homepage and /sitemap.xml, score same-origin links, verify the best ones with a GET.
import { extractLinks, htmlToText } from "@/lib/blocks/fetch-url";
import { safeFetch } from "@/lib/net";

export type LinkCandidate = {
  url: string;
  text: string;
  score: number;
  status: number;
  textLength: number;
  /** Page the link was found on (or the sitemap URL). */
  foundOn: string;
};
type RawLink = { href: string; text: string; foundOn: string };

const VERIFY_TOP = 5;
const MIN_TEXT_CHARS = 200;
const MAX_SITEMAP_LINKS = 200;

// Phrases that mean "the page where a product posts what changed".
const SYNONYM_GROUPS: string[][] = [
  [
    "changelog", "change log", "changes", "updates", "update", "whats new", "what s new", "releases", "release",
    "release notes", "releasenotes", "news", "blog", "product updates", "announcements",
  ],
  ["pricing", "plans", "price", "prices"],
  ["docs", "documentation", "guides", "help", "reference"],
  ["status", "uptime", "incidents"],
  ["careers", "jobs", "hiring"],
];

/** Lowercase, drop apostrophes, non-alphanumerics → spaces. "What's new" → "whats new". */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** extractLinks decodes decimal entities only; finish hex ones (Next renders ' as &#x27;). */
function decodeHex(s: string): string {
  return s.replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)));
}

function pathTokens(pathname: string): string[] {
  return norm(decodeURIComponent(pathname)).split(" ").filter(Boolean);
}

function stripTrailingSlash(u: string): string {
  return u.length > 1 && u.endsWith("/") ? u.slice(0, -1) : u;
}

function sameUrl(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin && stripTrailingSlash(ua.pathname) === stripTrailingSlash(ub.pathname);
  } catch {
    return a === b;
  }
}

/** Synonyms for the dead path's last segment (including the segment itself). */
function synonymsFor(segment: string): string[] {
  const n = norm(segment);
  const group = SYNONYM_GROUPS.find((g) => g.includes(n) || g.some((s) => s.replace(/ /g, "") === n.replace(/ /g, "")));
  return [...new Set([n, ...(group ?? [])])].filter(Boolean);
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${phrase} `) || haystack.replace(/ /g, "") === phrase.replace(/ /g, "");
}

/** Score a link. 0 = no semantic signal (not a candidate). */
export function scoreLink(deadUrl: URL, link: { href: string; text: string }): number {
  const deadTokens = pathTokens(deadUrl.pathname);
  const deadSeg = deadUrl.pathname.split("/").filter(Boolean).pop() ?? "";
  const syns = synonymsFor(deadSeg);
  const linkUrl = new URL(link.href);
  const linkSegs = linkUrl.pathname.split("/").filter(Boolean);
  const lastSeg = norm(decodeURIComponent(linkSegs[linkSegs.length - 1] ?? ""));
  const pathNorm = pathTokens(linkUrl.pathname).join(" ");
  const textNorm = norm(link.text);

  let semantic = 0;
  if (syns.some((s) => hasPhrase(lastSeg, s))) semantic += 5;
  else if (syns.some((s) => hasPhrase(pathNorm, s))) semantic += 3;
  if (textNorm && syns.some((s) => hasPhrase(textNorm, s))) semantic += 4;
  if (semantic === 0) return 0;

  const linkTokens = new Set(pathTokens(linkUrl.pathname));
  const shared = deadTokens.filter((t) => linkTokens.has(t) && t !== norm(deadSeg)).length;
  // Prefer siblings of the dead page (same parent path).
  const deadParent = deadUrl.pathname.split("/").filter(Boolean).slice(0, -1).join("/");
  const linkParent = linkSegs.slice(0, -1).join("/");
  const sibling = deadParent === linkParent ? 2 : 0;
  return semantic + shared + sibling;
}

async function fetchText(url: string): Promise<{ status: number; body: string; finalUrl: string } | null> {
  try {
    const res = await safeFetch(url);
    const body = res.ok ? await res.text() : "";
    return { status: res.status, body, finalUrl: res.url || url };
  } catch {
    return null;
  }
}

function sitemapLinks(xml: string): { text: string; href: string }[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].slice(0, MAX_SITEMAP_LINKS).map((m) => ({ text: "", href: m[1] }));
}

/** Pages worth crawling for links: parent path, homepage, sitemap. */
function sourcePages(dead: URL): string[] {
  const segs = dead.pathname.split("/").filter(Boolean);
  const pages: string[] = [];
  for (let i = segs.length - 1; i >= 1; i--) pages.push(`${dead.origin}/${segs.slice(0, i).join("/")}`);
  pages.push(`${dead.origin}/`);
  return [...new Set(pages)];
}

async function collectLinks(dead: URL): Promise<Map<string, RawLink>> {
  const links = new Map<string, RawLink>();
  const add = (l: RawLink) => {
    let u: URL;
    try {
      u = new URL(l.href);
    } catch {
      return;
    }
    if (u.origin !== dead.origin) return;
    u.hash = "";
    const key = stripTrailingSlash(u.toString());
    const prev = links.get(key);
    // Keep the most descriptive link text seen for this URL.
    if (!prev || (l.text && l.text.length > prev.text.length)) links.set(key, { href: key, text: l.text, foundOn: l.foundOn });
  };
  const [pages, sitemap] = await Promise.all([
    Promise.all(sourcePages(dead).map(fetchText)),
    fetchText(`${dead.origin}/sitemap.xml`),
  ]);
  for (const p of pages) {
    if (p?.body) extractLinks(p.body, p.finalUrl).forEach((l) => add({ ...l, text: decodeHex(l.text), foundOn: p.finalUrl }));
  }
  if (sitemap?.body && /<urlset|<sitemapindex/i.test(sitemap.body)) {
    sitemapLinks(sitemap.body).forEach((l) => add({ ...l, foundOn: `${dead.origin}/sitemap.xml` }));
  }
  return links;
}

async function verify(c: RawLink & { score: number }): Promise<LinkCandidate | null> {
  const r = await fetchText(c.href);
  if (!r || r.status !== 200) return null;
  const textLength = htmlToText(r.body).length;
  if (textLength < MIN_TEXT_CHARS) return null;
  return { url: c.href, text: c.text, score: c.score, status: r.status, textLength, foundOn: c.foundOn };
}

/** Verified, ranked candidates for where `deadUrl` moved. Never throws; [] when nothing fits. */
export async function findLinkCandidates(deadUrl: string): Promise<LinkCandidate[]> {
  let dead: URL;
  try {
    dead = new URL(deadUrl);
  } catch {
    return [];
  }
  try {
    const links = await collectLinks(dead);
    const scored = [...links.values()]
      .filter((l) => !sameUrl(l.href, deadUrl))
      .map((l) => ({ ...l, score: scoreLink(dead, l) }))
      .filter((l) => l.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, VERIFY_TOP);
    const verified = await Promise.all(scored.map(verify));
    return verified.filter((v): v is LinkCandidate => v !== null).sort((a, b) => b.score - a.score);
  } catch (e) {
    console.error("[link-candidates] failed:", (e as Error).message);
    return [];
  }
}
