"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAgents, getStats } from "@/lib/api-client";
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

const WORKING = new Set(["repairing", "building", "testing"]);

function FactoryGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="3" fill="#1c1917" />
      <path d="M5 25V14l6 3.5V14l6 3.5V9h4v16z" fill="#F6F4EF" />
      <circle cx="24" cy="9" r="5" fill="#7c3aed" stroke="#F6F4EF" strokeWidth="1.5" />
      <circle cx="24" cy="9" r="1.6" fill="#F6F4EF" />
    </svg>
  );
}

function useFactoryPulse() {
  const [working, setWorking] = useState(false);
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const pollAgents = async () => {
      try {
        const agents = await getAgents();
        if (alive) setWorking(agents.some((a) => WORKING.has(a.status)));
      } catch {
        /* keep last known state */
      }
    };
    const pollStats = async () => {
      try {
        const s = await getStats();
        if (alive) setLive(s.agentsLive);
      } catch {
        /* keep last known state */
      }
    };
    void pollAgents();
    void pollStats();
    const a = setInterval(pollAgents, 5000);
    const b = setInterval(pollStats, 10000);
    return () => {
      alive = false;
      clearInterval(a);
      clearInterval(b);
    };
  }, []);
  return { working, live };
}

export function TopBar() {
  const { working, live } = useFactoryPulse();
  const path = usePathname();
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [path]);
  return (
    <header className={cn("sticky top-0 z-20 border-b border-stone-300 bg-[#F6F4EF]/90 shadow-[0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md", working && "bar-shimmer")}>
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5 rounded-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60">
          <span className="transition-transform duration-200 group-hover:-rotate-6 group-active:scale-95"><FactoryGlyph /></span>
          <span className="font-mono text-[13px] font-semibold tracking-[0.2em] text-stone-900">AGENT FACTORY</span>
        </Link>
        <nav
          ref={navRef}
          aria-label="Main"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] sm:flex-none sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-[3px] px-2.5 py-1 text-[14px] transition-colors active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60",
                  active ? "bg-stone-900 text-[#F6F4EF]" : "text-stone-600 hover:bg-stone-200/70 hover:text-stone-900",
                )}
              >
                {n.label}
                {"highlight" in n && n.highlight && !active ? <span aria-hidden className="ml-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-violet-600" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden shrink-0 items-center gap-3 font-mono text-[11px] text-stone-500 sm:flex">
          <span className="inline-flex items-center gap-1.5 text-stone-700" title="Agents currently live">
            <span className="text-emerald-600">●</span>
            <span className="tabular-nums">{live ?? "–"}</span> agents live
          </span>
          <span className="inline-flex items-center gap-1.5">
            cron <span className="animate-pulse text-emerald-600">●</span> every minute
          </span>
          <Clock />
        </div>
      </div>
    </header>
  );
}
