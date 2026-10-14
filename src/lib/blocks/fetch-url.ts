import { safeFetch } from "@/lib/net";
import { fail, ok, type BlockRunner } from "./types";

const MAX_TEXT = 20_000;
const MAX_LINKS = 200;

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)));

export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|nav|footer|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function extractLinks(html: string, base: string): { text: string; href: string }[] {
  const seen = new Set<string>();
  const links: { text: string; href: string }[] = [];
  const re = /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && links.length < MAX_LINKS) {
    const raw = (m[1] ?? m[2] ?? "").trim();
    if (!raw || raw.startsWith("#") || /^(javascript|mailto|tel):/i.test(raw)) continue;
    let href: string;
    try {
      href = new URL(decode(raw), base).toString();
    } catch {
      continue;
    }
    if (!/^https?:/.test(href) || seen.has(href)) continue;
    seen.add(href);
    links.push({ text: htmlToText(m[3]).slice(0, 200), href });
  }
  return links;
}

export const fetchUrl: BlockRunner = async (params) => {
  const url = String(params?.url ?? "");
  if (!url) return fail("fetch_url: missing required param 'url'");
  const res = await safeFetch(url);
  if (!res.ok) return fail(`HTTP ${res.status} ${res.statusText} for ${url}`);
  const body = await res.text();
  const isHtml = /html|xml/i.test(res.headers.get("content-type") ?? "") || /<html|<body/i.test(body.slice(0, 2000));
  const title = decode(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const text = (isHtml ? htmlToText(body) : body).slice(0, MAX_TEXT);
  return ok({ url: res.url || url, status: res.status, title, text, links: isHtml ? extractLinks(body, res.url || url) : [] });
};
