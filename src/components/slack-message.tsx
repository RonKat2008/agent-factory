import type { ReactNode } from "react";

// Slack mrkdwn -> safe React elements (no dangerouslySetInnerHTML).
// Supports <url|label>, <url>, bare URLs, *bold*, _italic_, `code`, and &amp; &lt; &gt; entities.
const TOKEN = /<(https?:\/\/[^|>\s]+)(?:\|([^>]*))?>|(https?:\/\/[^\s<>]+)|\*([^*\n]+)\*|_([^_\n]+)_|`([^`\n]+)`/g;
const LINK = "text-sky-700 underline underline-offset-2 hover:text-sky-900 break-all";

const unescape = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function renderSlack(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(unescape(text.slice(last, idx)));
    const [, url, label, bare, bold, italic, code] = m;
    if (url || bare) {
      const href = unescape(url ?? bare);
      out.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
          {unescape(label || href)}
        </a>,
      );
    } else if (bold) {
      out.push(<strong key={key++} className="font-semibold">{renderSlack(bold)}</strong>);
    } else if (italic) {
      out.push(<em key={key++}>{renderSlack(italic)}</em>);
    } else if (code) {
      out.push(
        <code key={key++} className="rounded-[2px] bg-stone-200/70 px-1 font-mono text-[12px]">
          {unescape(code)}
        </code>,
      );
    }
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(unescape(text.slice(last)));
  return out;
}

/** A Slack-style message body: mrkdwn rendered safely, newlines preserved. */
export function SlackMessage({ text, className }: { text: string; className?: string }) {
  return <p className={className ?? "whitespace-pre-wrap break-words text-[13px] leading-relaxed text-stone-900"}>{renderSlack(text)}</p>;
}
