import type { ReactNode } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { PANEL } from "@/components/ui-tokens";
import { cn } from "@/lib/utils";

type Props = {
  n: number;
  title: string;
  lede: ReactNode;
  different: ReactNode;
  tryIt: ReactNode;
  products: readonly string[];
  hood: ReactNode;
};

/** One chapter: what it is, why it matters, a live try-it, and how it works. */
export function ChapterShell({ n, title, lede, different, tryIt, products, hood }: Props) {
  return (
    <article aria-labelledby={`chapter-${n}-title`} className="space-y-6">
      <header className="space-y-3">
        <p className="font-mono text-[12px] tabular-nums text-violet-700">Chapter {n} of 8</p>
        <h2 id={`chapter-${n}-title`} className="text-[clamp(26px,3.6vw,38px)] font-semibold leading-[1.08] tracking-[-0.025em] text-stone-900">
          {title}
        </h2>
        <div className="max-w-[64ch] space-y-2 text-[15.5px] leading-relaxed text-stone-700">{lede}</div>
      </header>

      <aside className="flex max-w-[72ch] gap-3 rounded-[3px] border border-violet-200 border-l-4 border-l-violet-600 bg-violet-50/70 px-4 py-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden />
        <div className="text-[14px] leading-relaxed text-violet-950">
          <p className="font-semibold">What makes this different</p>
          <div className="mt-0.5">{different}</div>
        </div>
      </aside>

      <section aria-label="Try it" className={cn(PANEL, "p-4 sm:p-6")}>
        <p className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-stone-900">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Try it, live
        </p>
        {tryIt}
      </section>

      <details className="group rounded-[3px] border border-stone-300 bg-white/60">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[14px] font-medium text-stone-900 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 text-stone-500 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
          What just happened under the hood
          <span className="ml-auto hidden flex-wrap justify-end gap-1 sm:flex">
            {products.map((p) => (
              <span key={p} className="rounded-[2px] border border-stone-300 bg-stone-50 px-1.5 py-px text-[11px] font-normal text-stone-600">{p}</span>
            ))}
          </span>
        </summary>
        <div className="space-y-2 border-t border-stone-200 px-4 py-3 text-[14px] leading-relaxed text-stone-700">
          <ul className="flex flex-wrap gap-1 sm:hidden">
            {products.map((p) => (
              <li key={p} className="rounded-[2px] border border-stone-300 bg-stone-50 px-1.5 py-px text-[11px] text-stone-600">{p}</li>
            ))}
          </ul>
          {hood}
        </div>
      </details>
    </article>
  );
}

/** A friendly inline notice for rate limits and errors. */
export function Notice({ tone = "amber", children }: { tone?: "amber" | "red" | "stone"; children: ReactNode }) {
  const styles = {
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    red: "border-red-300 bg-red-50 text-red-900",
    stone: "border-stone-300 bg-stone-50 text-stone-700",
  }[tone];
  return (
    <p role="status" className={cn("rounded-[3px] border px-3 py-2 text-[13.5px]", styles)}>
      {children}
    </p>
  );
}
