import { safeFetch } from "@/lib/net";
import { fail, ok, type BlockRunner, type Item } from "./types";

const DEFAULT_LIMIT = 10;
const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  const cdata = m[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (cdata ? cdata[1] : decode(m[1])).trim();
}
const strip = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function parseFeed(xml: string, limit: number): Item[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  return blocks.slice(0, limit).flatMap((b) => {
    const title = strip(tag(b, "title"));
    let url = tag(b, "link");
    if (!url) {
      const links = [...b.matchAll(/<link\b[^>]*>/gi)].map((l) => l[0]);
      const alt = links.find((l) => /rel\s*=\s*["']alternate["']/i.test(l)) ?? links[0];
      url = alt?.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    }
    if (!url) url = tag(b, "guid");
    if (!title && !url) return [];
    const summary = strip(tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 500);
    const publishedAt = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated");
    const item: Item = { title, url: decode(url) };
    if (summary) item.summary = summary;
    if (publishedAt) item.publishedAt = publishedAt;
    return [item];
  });
}

export const fetchRss: BlockRunner = async (params) => {
  const url = String(params?.url ?? "");
  if (!url) return fail("fetch_rss: missing required param 'url'");
  const limit = Number(params?.limit) > 0 ? Number(params.limit) : DEFAULT_LIMIT;
  const res = await safeFetch(url);
  if (!res.ok) return fail(`HTTP ${res.status} ${res.statusText} for ${url}`);
  const items = parseFeed(await res.text(), limit);
  if (items.length === 0) return fail(`No RSS/Atom items found at ${url}`);
  return ok({ items });
};
