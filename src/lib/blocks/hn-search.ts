import { safeFetch } from "@/lib/net";
import { fail, ok, type BlockRunner, type Item } from "./types";

type Hit = { objectID: string; title?: string; story_title?: string; url?: string | null; points?: number; created_at?: string };

export const hnSearch: BlockRunner = async (params) => {
  const query = String(params?.query ?? "");
  if (!query) return fail("hn_search: missing required param 'query'");
  const sinceHours = Number(params?.sinceHours) > 0 ? Number(params.sinceHours) : 24;
  const limit = Number(params?.limit) > 0 ? Number(params.limit) : 10;
  const since = Math.floor(Date.now() / 1000 - sinceHours * 3600);
  const filters = [`created_at_i>${since}`];
  if (typeof params?.minPoints === "number") filters.push(`points>=${params.minPoints}`);
  const url =
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story` +
    `&numericFilters=${encodeURIComponent(filters.join(","))}&hitsPerPage=${limit}`;
  const res = await safeFetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return fail(`HTTP ${res.status} ${res.statusText} for ${url}`);
  const data = (await res.json()) as { hits?: Hit[] };
  const items: Item[] = (data.hits ?? []).slice(0, limit).map((h) => ({
    title: h.title ?? h.story_title ?? "(untitled)",
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    points: h.points ?? 0,
    ...(h.created_at ? { publishedAt: h.created_at } : {}),
  }));
  return ok({ items });
};
