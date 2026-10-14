"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Menu, X } from "lucide-react";
import { getAgents, getStats } from "@/lib/api-client";
import { AskOps } from "@/components/ops/ask-ops";
import { HelpMenu, toggleExplainMode, useExplainMode } from "@/components/explain";
import { replayIntro } from "@/components/onboarding/onboarding-store";
import { DISTANCE, DURATION, EASE, NumberTicker, SPRING } from "@/components/motion";
import { SignInWithSlack, UserMenu, useMe } from "@/components/slack-connect";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; tour?: string; match: (p: string) => boolean };

const MAIN: NavItem[] = [
  { href: "/", label: "Home", match: (p) => p === "/" || p.startsWith("/new") },
  { href: "/fleet", label: "My agents", tour: "nav-agents", match: (p) => p.startsWith("/fleet") || p.startsWith("/agents") },
  { href: "/tour", label: "Tour", tour: "nav-tour", match: (p) => p.startsWith("/tour") },
];

const MORE = [
  { href: "/graph", label: "Graph", hint: "How your agents feed each other" },
  { href: "/outbox", label: "Outbox", hint: "Everything your agents sent" },
  { href: "/connections", label: "Connections", hint: "Apps your agents can use" },
] as const;

const WORKING = new Set(["repairing", "building", "testing"]);
const TOUR_SEEN_KEY = "af_tour_seen";
const AGENTS_POLL_MS = 5000;
const STATS_POLL_MS = 10000;

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60";
const TAB = cn("relative inline-flex h-8 shrink-0 items-center rounded-[3px] px-2 text-[13px] sm:px-2.5 sm:text-[14px]", FOCUS_RING);

const subscribeNone = () => () => {};
const subscribeStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
function readTourSeen(): boolean {
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

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
    const a = setInterval(pollAgents, AGENTS_POLL_MS);
    const b = setInterval(pollStats, STATS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(a);
      clearInterval(b);
    };
  }, []);
  return { working, live };
}

/** The dark pill that glides between tabs. */
function ActivePill() {
  return <motion.span layoutId="nav-active" aria-hidden className="absolute inset-0 rounded-[3px] bg-stone-900" transition={SPRING.snappy} />;
}

function Tab({ item, active, dot }: { item: NavItem; active: boolean; dot?: boolean }) {
  return (
    <Link
      href={item.href}
      data-tour={item.tour}
      aria-current={active ? "page" : undefined}
      className={cn(TAB, "transition-colors active:scale-[0.97]", active ? "text-[#F6F4EF]" : "text-stone-600 hover:bg-stone-200/70 hover:text-stone-900")}
    >
      {active && <ActivePill />}
      <span className="relative">{item.label}</span>
      {dot && !active && (
        <span aria-label="new" className="relative ml-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-violet-600" />
      )}
    </Link>
  );
}

function useDismiss(open: boolean, close: () => void, rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, rootRef]);
}

const MENU_ITEM = cn("flex flex-col rounded-[3px] px-2.5 py-2 text-left hover:bg-stone-200/60 focus-visible:bg-stone-200/60", FOCUS_RING);

function MoreMenu({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useDismiss(open, close, rootRef);
  const current = MORE.find((m) => path.startsWith(m.href));
  return (
    <div ref={rootRef} className="relative hidden md:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(TAB, "gap-1 transition-colors", current ? "text-[#F6F4EF]" : "text-stone-600 hover:bg-stone-200/70 hover:text-stone-900")}
      >
        {current && <ActivePill />}
        <span className="relative">{current?.label ?? "More"}</span>
        <motion.span className="relative" animate={{ rotate: open ? 180 : 0 }} transition={SPRING.snappy}>
          <ChevronDown className="size-3.5" aria-hidden />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="more"
            role="menu"
            aria-label="More pages"
            className="absolute right-0 top-[calc(100%+6px)] z-50 grid w-64 origin-top-right gap-0.5 rounded-[4px] border border-stone-300 bg-[#FBFAF7] p-1 shadow-[0_16px_40px_-16px_rgba(28,25,23,0.45)]"
            initial={{ opacity: 0, y: -DISTANCE.xs, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: DURATION.instant } }}
            transition={SPRING.snappy}
          >
            {MORE.map((m) => (
              <Link key={m.href} href={m.href} role="menuitem" onClick={close} aria-current={path.startsWith(m.href) ? "page" : undefined} className={MENU_ITEM}>
                <span className={cn("text-[13px] text-stone-900", path.startsWith(m.href) && "font-semibold")}>{m.label}</span>
                <span className="text-[11px] text-stone-500">{m.hint}</span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Mobile: the "More" pages plus the Help actions, in a sheet that drops from the top. */
function MobileSheet({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(subscribeNone, () => true, () => false);
  const explain = useExplainMode();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn("grid size-8 shrink-0 place-items-center rounded-[3px] border border-stone-300 bg-[#FBFAF7] text-stone-800 md:hidden", FOCUS_RING)}
      >
        <Menu className="size-4" aria-hidden />
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="sheet"
                className="fixed inset-0 z-[60] bg-stone-900/40 md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE.out }}
                onMouseDown={(e) => e.target === e.currentTarget && close()}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menu"
                  className="absolute inset-x-0 top-0 rounded-b-[6px] border-b border-stone-300 bg-[#F6F4EF] px-4 pb-5 pt-3 shadow-[0_24px_60px_-20px_rgba(28,25,23,0.55)]"
                  initial={{ y: "-100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-100%", transition: { duration: DURATION.fast, ease: EASE.in } }}
                  transition={SPRING.gentle}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-semibold text-stone-900">More</span>
                    <button type="button" autoFocus aria-label="Close menu" onClick={close} className={cn("grid size-8 place-items-center rounded-[3px] text-stone-700 hover:bg-stone-200", FOCUS_RING)}>
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  <nav aria-label="More pages" className="mt-2 grid gap-0.5">
                    {MORE.map((m) => (
                      <Link key={m.href} href={m.href} onClick={close} aria-current={path.startsWith(m.href) ? "page" : undefined} className={cn(MENU_ITEM, path.startsWith(m.href) && "bg-stone-200/70")}>
                        <span className="text-[15px] text-stone-900">{m.label}</span>
                        <span className="text-[12px] text-stone-500">{m.hint}</span>
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-3 border-t border-stone-300 pt-3">
                    <SheetAccount />
                  </div>
                  <div className="mt-3 grid gap-0.5 border-t border-stone-300 pt-3">
                    <button type="button" className={cn(MENU_ITEM, "text-[14px] text-stone-800")} onClick={() => { close(); replayIntro(); }}>
                      Replay intro
                    </button>
                    <button type="button" role="switch" aria-checked={explain} className={cn(MENU_ITEM, "flex-row items-center justify-between text-[14px] text-stone-800")} onClick={toggleExplainMode}>
                      Explain mode
                      <span aria-hidden className={cn("relative h-4 w-7 shrink-0 rounded-full transition-colors", explain ? "bg-violet-600" : "bg-stone-300")}>
                        <motion.span className="absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow" animate={{ x: explain ? 12 : 0 }} transition={SPRING.snappy} />
                      </span>
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/** Mobile sheet's account row (the top bar's <UserMenu> is hidden below md to keep the bar on one line). */
function SheetAccount() {
  const { me } = useMe();
  if (!me) return null;
  if (!me.user) return <SignInWithSlack isConfigured={me.slackOAuth.configured} size="lg" className="w-full" />;
  return (
    <p className="flex items-center gap-2 px-2.5 text-[14px] text-stone-700">
      <span className="grid size-6 place-items-center rounded-[4px] bg-violet-700 text-[11px] font-semibold text-white" aria-hidden>
        {me.user.name.slice(0, 1).toUpperCase()}
      </span>
      Signed in as <span className="font-medium text-stone-900">{me.user.name}</span>
    </p>
  );
}

export function TopBar() {
  const { working, live } = useFactoryPulse();
  const path = usePathname() ?? "/";
  const tourSeen = useSyncExternalStore(subscribeStorage, readTourSeen, () => true);

  return (
    <header className={cn("sticky top-0 z-20 border-b border-stone-300 bg-[#F6F4EF]/90 shadow-[0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md", working && "bar-shimmer")}>
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link href="/" aria-label="Agent Factory home" className={cn("group flex shrink-0 items-center gap-2.5 rounded-[3px]", FOCUS_RING)}>
          <span className="transition-transform duration-200 group-hover:-rotate-6 group-active:scale-95">
            <FactoryGlyph />
          </span>
          <span className="hidden font-mono text-[13px] font-semibold tracking-[0.2em] text-stone-900 lg:inline">AGENT FACTORY</span>
        </Link>
        <nav aria-label="Main" className="flex min-w-0 items-center gap-0.5 sm:gap-1">
          {MAIN.map((n) => (
            <Tab key={n.href} item={n} active={n.match(path)} dot={n.href === "/tour" && !tourSeen} />
          ))}
          <MoreMenu path={path} />
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Below lg, Ask Ops collapses to its icon (the label is clipped, the button keeps its accessible text). */}
          <div className="flex max-lg:[&>button]:w-8 max-lg:[&>button]:gap-4 max-lg:[&>button]:overflow-hidden max-lg:[&>button]:px-[7px] max-lg:[&>button]:whitespace-nowrap max-lg:[&>button>svg]:shrink-0">
            <AskOps />
          </div>
          <HelpMenu className="hidden md:block" />
          <MobileSheet path={path} />
          <span className="hidden items-center gap-1.5 font-mono text-[12px] text-stone-700 xl:inline-flex" title="Agents that are on right now">
            <span className="relative grid size-2 place-items-center" aria-hidden>
              <span className="absolute inset-0 rounded-full bg-emerald-500/60 motion-safe:animate-ping" />
              <span className="relative size-2 rounded-full bg-emerald-600" />
            </span>
            {live === null ? <span className="tabular-nums">–</span> : <NumberTicker value={live} className="tabular-nums" />}
            <span>live</span>
          </span>
          <div className="hidden shrink-0 md:flex">
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
