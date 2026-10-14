import type { ReactNode } from "react";

export const usd = (n: number) => `$${n < 0.1 ? n.toFixed(4) : n.toFixed(2)}`;

export { LABEL, PANEL, BTN, BTN_PRIMARY, BTN_SECONDARY } from "@/components/ui-tokens";
export { durationMs, fullTime, relTime } from "@/components/time";

const LINK_RE = /<(https?:\/\/[^|>\s]+)\|([^>]+)>|(https?:\/\/[^\s<>)\]]+)/g;
const linkCls = "text-sky-700 underline underline-offset-2 hover:text-sky-900 break-all";

/** Renders Slack `<url|label>` links and bare URLs as safe anchors. */
export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const href = m[1] ?? m[3];
    const label = m[2] ?? m[3];
    out.push(
      <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={linkCls}>
        {label}
      </a>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
