"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Cog, Factory } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/tour", label: "Tour", highlight: true },
  { href: "/", label: "Fleet" },
  { href: "/new", label: "New agent" },
  { href: "/outbox", label: "Outbox" },
  { href: "/connections", label: "Connections" },
];

function Clock() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString([], { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums text-stone-700">{t ?? "--:--:--"}</span>;
}

export function TopBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-stone-300 bg-[#F6F4EF]/95 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40">
          <span className="relative grid size-6 place-items-center rounded-[3px] bg-stone-900 text-[#F6F4EF]">
            <Factory className="size-3.5" aria-hidden />
            <Cog className="absolute -right-1 -top-1 size-3 rounded-full bg-[#F6F4EF] text-violet-600" aria-hidden />
          </span>
          <span className="font-mono text-[13px] font-semibold tracking-[0.18em]">AGENT FACTORY</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-[3px] px-2.5 py-1 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40",
                  active ? "bg-stone-900 text-[#F6F4EF]" : "text-stone-600 hover:bg-stone-200/70 hover:text-stone-900",
                )}
              >
                {n.label}
                {"highlight" in n && n.highlight && !active ? <span aria-hidden className="ml-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-violet-600" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-stone-500">
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            cron <span className="animate-pulse text-emerald-600">●</span> every minute
          </span>
          <Clock />
        </div>
      </div>
    </header>
  );
}
