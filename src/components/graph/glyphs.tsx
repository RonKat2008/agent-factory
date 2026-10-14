import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Spec = { bg: string; fg: string; glyph: ReactNode };

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const SPECS: Record<string, Spec> = {
  exa: {
    bg: "bg-sky-500/15 ring-sky-400/30", fg: "text-sky-300",
    glyph: (<g {...S}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /><path d="M11 8.5v5M8.5 11h5" /></g>),
  },
  "hacker-news": {
    bg: "bg-orange-500/20 ring-orange-400/40", fg: "text-orange-300",
    glyph: (<g {...S}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8.5 8 3.5 5 3.5-5M12 13v4" /></g>),
  },
  web: {
    bg: "bg-teal-500/15 ring-teal-400/30", fg: "text-teal-300",
    glyph: (<g {...S}><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.5 2.3 3.5 5 3.5 8s-1 5.7-3.5 8c-2.5-2.3-3.5-5-3.5-8s1-5.7 3.5-8Z" /></g>),
  },
  rss: {
    bg: "bg-amber-500/15 ring-amber-400/30", fg: "text-amber-300",
    glyph: (<g {...S}><path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14" /><circle cx="6" cy="18" r="1.2" fill="currentColor" /></g>),
  },
  kernel: {
    bg: "bg-emerald-500/15 ring-emerald-400/30", fg: "text-emerald-300",
    glyph: (<g {...S}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m7.5 10 2.5 2-2.5 2M12.5 14.5h4" /></g>),
  },
  context7: {
    bg: "bg-indigo-500/15 ring-indigo-400/30", fg: "text-indigo-300",
    glyph: (<g {...S}><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5Z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19M9.5 8.5h6M9.5 12h4" /></g>),
  },
  deepwiki: {
    bg: "bg-cyan-500/15 ring-cyan-400/30", fg: "text-cyan-300",
    glyph: (<g {...S}><path d="M4 7c2-1.5 5-1.5 8 0 3-1.5 6-1.5 8 0v11c-2-1.5-5-1.5-8 0-3-1.5-6-1.5-8 0Z" /><path d="M12 7v11" /></g>),
  },
  github: {
    bg: "bg-stone-400/15 ring-stone-300/30", fg: "text-stone-200",
    glyph: (<g {...S}><circle cx="7" cy="6" r="2" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="9" r="2" /><path d="M7 8v8M17 11c0 3-4 3-9 5" /></g>),
  },
  slack: {
    bg: "bg-fuchsia-500/15 ring-fuchsia-400/30", fg: "text-fuchsia-300",
    glyph: (<g {...S}><path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h16M3.5 15h16" /></g>),
  },
  outbox: {
    bg: "bg-violet-500/15 ring-violet-400/30", fg: "text-violet-300",
    glyph: (<g {...S}><path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20" /><path d="M4 13 6.5 6h11L20 13v5H4Z" /></g>),
  },
  plug: {
    bg: "bg-stone-400/15 ring-stone-300/25", fg: "text-stone-300",
    glyph: (<g {...S}><path d="M9 4v5M15 4v5M6.5 9h11v3a5.5 5.5 0 0 1-11 0ZM12 17.5V21" /></g>),
  },
};

export function glyphKey(slug: string | undefined, label: string): string {
  const k = `${slug ?? ""} ${label}`.toLowerCase();
  if (k.includes("exa")) return "exa";
  if (k.includes("hacker") || k.includes("hn")) return "hacker-news";
  if (k.includes("rss")) return "rss";
  if (k.includes("web") || k.includes("fetch") || k.includes("http")) return "web";
  if (k.includes("kernel")) return "kernel";
  if (k.includes("context7")) return "context7";
  if (k.includes("deepwiki")) return "deepwiki";
  if (k.includes("github")) return "github";
  if (k.includes("slack")) return "slack";
  if (k.includes("outbox")) return "outbox";
  return "plug";
}

/** Small rounded tile with an inline SVG glyph. Decorative: the name is always rendered next to it. */
export function SourceGlyph({ name, className }: { name: string; className?: string }) {
  const spec = SPECS[name] ?? SPECS.plug;
  return (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-[7px] ring-1", spec.bg, spec.fg, className)}>
      <svg viewBox="0 0 24 24" className="size-[18px]">{spec.glyph}</svg>
    </span>
  );
}
