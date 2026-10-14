"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Rocket, Zap } from "lucide-react";
import { BTN_PRIMARY } from "@/components/ui-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { eventStyle } from "@/components/event-style";
import { clockTime } from "@/components/time";
import { DISTANCE, DURATION, EASE, SPRING } from "@/components/motion";
import { getAgents, getFeed, getOutbox, runNow } from "@/lib/api-client";
import type { Agent, FeedEvent, OutboxMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChapterShell, Notice } from "./chapter-shell";
import { friendlyError } from "./chapters";
import { SlackPost } from "./slack-post";
import { getTour, tourAction } from "./tour-api";

const POLL_MS = 2000;
const SKEW_MS = 1500;
/** When someone else just published, show their chain (it started within this window). */
const WATCH_THEIRS_MS = 45_000;
const GIVE_UP_MS = 4 * 60_000;

type Cast = { watcher: Agent | null; deepDive: Agent | null };

function useCast(): { cast: Cast | null; error: string | null } {
  const [cast, setCast] = useState<Cast | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([getTour(), getAgents()])
      .then(([tour, agents]) => {
        if (!alive) return;
        const deepDive = agents.find((a) => a.name === "Competitor deep-dive") ?? agents.find((a) => /deep-dive/i.test(a.name)) ?? null;
        setCast({ watcher: tour.watcher, deepDive });
      })
      .catch((e: unknown) => alive && setError(friendlyError(e)));
    return () => { alive = false; };
  }, []);
  return { cast, error };
}

type Live = { watcherEvents: FeedEvent[]; deepEvents: FeedEvent[]; watcherPost: OutboxMessage | null; deepPost: OutboxMessage | null };
const EMPTY: Live = { watcherEvents: [], deepEvents: [], watcherPost: null, deepPost: null };

/** Polls both agents' events and posts since `since`. Stops on unmount, when done, or after a few minutes. */
function useChain(cast: Cast | null, since: number | null): Live {
  const [state, setState] = useState<{ since: number | null; live: Live }>({ since: null, live: EMPTY });
  const current = state.since === since ? state.live : EMPTY;
  const done = current.deepPost !== null;
  useEffect(() => {
    if (!cast?.watcher || since === null || done) return;
    let alive = true;
    const after = (iso: string) => Date.parse(iso) >= since;
    const asc = (a: { createdAt: string }, b: { createdAt: string }) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
    const load = async () => {
      if (Date.now() - since > GIVE_UP_MS) return;
      try {
        const [we, de, out] = await Promise.all([
          getFeed({ agentId: cast.watcher!.id }),
          cast.deepDive ? getFeed({ agentId: cast.deepDive.id }) : Promise.resolve([] as FeedEvent[]),
          getOutbox(),
        ]);
        if (!alive) return;
        const posts = out.filter((m) => after(m.createdAt)).sort(asc);
        setState({ since, live: {
          watcherEvents: we.filter((e) => after(e.createdAt)).sort(asc),
          deepEvents: de.filter((e) => after(e.createdAt)).sort(asc),
          watcherPost: posts.find((m) => m.agentId === cast.watcher!.id && !/I fixed|I couldn't fix|Pit stop complete|Pitcrew needs you/.test(m.body)) ?? null,
          deepPost: cast.deepDive ? (posts.find((m) => m.agentId === cast.deepDive!.id) ?? null) : null,
        } });
      } catch {
        /* keep last good data */
      }
    };
    void load();
    const t = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [cast, since, done]);
  return current;
}

function EventRows({ events, empty }: { events: FeedEvent[]; empty: string }) {
  if (events.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-stone-500">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> {empty}
      </p>
    );
  }
  return (
    <ol className="space-y-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {events.map((e) => {
          const st = eventStyle(e.type);
          const Icon = st.icon;
          return (
            <motion.li key={e.id} initial={{ opacity: 0, y: DISTANCE.sm }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING.gentle} className="flex gap-2.5">
              <Icon className={cn("mt-0.5 size-4 shrink-0", st.color, st.spin && "animate-spin")} aria-hidden />
              <p className="min-w-0 flex-1 text-[13px] leading-snug text-stone-800">{e.type === "triggered" ? <strong>⚡ {e.message}</strong> : e.message}</p>
              <time className="font-mono text-[11px] tabular-nums text-stone-400" dateTime={e.createdAt}>{clockTime(e.createdAt)}</time>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

function Column({ title, role, children }: { title: string; role: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 space-y-3 rounded-[3px] border border-stone-300 bg-white p-4">
      <header>
        <p className="text-[14.5px] font-semibold text-stone-900">{title}</p>
        <p className="text-[12.5px] text-stone-500">{role}</p>
      </header>
      {children}
    </section>
  );
}

function ChainDemo() {
  const { cast, error } = useCast();
  const [since, setSince] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "amber" | "red"; text: string } | null>(null);
  const live = useChain(cast, since);
  const triggered = live.deepEvents.some((e) => e.type === "triggered");

  const ship = useCallback(async () => {
    if (!cast?.watcher) return;
    setPending(true);
    setNotice(null);
    const res = await tourAction("publish");
    if (!res.ok) {
      setPending(false);
      if (res.retryInSec) {
        setNotice({ tone: "amber", text: `Someone just shipped an Acme release, so you are watching their chain reaction below. You can ship another in ${res.retryInSec}s.` });
        setSince(Date.now() - WATCH_THEIRS_MS);
      } else {
        setNotice({ tone: "red", text: friendlyError(new Error(res.error)) });
      }
      return;
    }
    setSince(Date.now() - SKEW_MS);
    try {
      await runNow(cast.watcher.id);
    } catch (e) {
      setNotice({ tone: "amber", text: `The release is out, but the watcher run did not start: ${friendlyError(e)} It also runs on its schedule.` });
    } finally {
      setPending(false);
    }
  }, [cast]);

  if (error) return <Notice tone="red">{error}</Notice>;
  if (!cast) return <Skeleton className="h-40 rounded-[3px]" />;
  if (!cast.watcher) return <Notice>The demo watcher agent has not been set up on this deployment.</Notice>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void ship()} disabled={pending} className={cn(BTN_PRIMARY, "h-11 px-5 text-[15px]")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
          {since === null ? "Acme ships a feature" : "Ship another release"}
        </button>
        <p className="text-[13px] text-stone-500">Publishes a fake Acme release, then runs the watcher right away.</p>
      </div>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {!cast.deepDive && <Notice tone="stone">The Competitor deep-dive agent is not on this deployment, so only the watcher half will show.</Notice>}

      {since !== null && (
        <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Column title={cast.watcher.name} role="Reads Acme's changelog, posts what's new">
            <EventRows events={live.watcherEvents} empty="Waiting for the watcher to run…" />
            {live.watcherPost && <SlackPost message={live.watcherPost} label="#competitive-intel" />}
          </Column>
          <div className="flex items-center justify-center md:flex-col" aria-hidden>
            <motion.span
              animate={triggered ? { scale: [1, 1.25, 1], opacity: 1 } : { opacity: 0.35 }}
              transition={{ duration: DURATION.slow, ease: EASE.out }}
              className={cn("grid size-10 place-items-center rounded-full border-2", triggered ? "border-violet-600 bg-violet-600 text-white" : "border-stone-300 bg-white text-stone-400")}
            >
              <Zap className="size-5" />
            </motion.span>
            <span className={cn("ml-2 text-[12px] font-medium md:ml-0 md:mt-1.5", triggered ? "text-violet-800" : "text-stone-400")}>{triggered ? "Triggered" : "waiting"}</span>
          </div>
          <Column title={cast.deepDive?.name ?? "Competitor deep-dive"} role="Researches each release with Exa, posts an analysis">
            <EventRows events={live.deepEvents} empty={live.watcherPost ? "Starting the deep-dive…" : "Waits for the watcher's post…"} />
            {live.deepPost && <SlackPost message={live.deepPost} label="#competitive-intel" />}
          </Column>
        </div>
      )}
    </div>
  );
}

export function ChapterChain() {
  return (
    <ChapterShell
      n={3}
      title="Chain reaction"
      lede={
        <p>
          Agents can trigger other agents. When the watcher posts about a new Acme release, that post automatically starts a second agent, the Competitor deep-dive, which researches the release on the web and posts an analysis. You wire this up in plain English, not with a flowchart.
        </p>
      }
      different={
        <p>
          The chain only fires on a post that passed its tests, and it has guards built in: no loops, a three-hop depth limit, and a paused or broken agent never gets triggered.
        </p>
      }
      tryIt={<ChainDemo />}
      products={["Workflow DevKit", "Cron", "AI Gateway", "Exa (MCP)"]}
      hood={
        <>
          <p>Each agent run is a durable Vercel Workflow. When a run posts, the workflow checks for downstream agents and starts their runs with the post as input, recording a &quot;Triggered by&quot; event.</p>
          <p>The deep-dive calls Exa&apos;s search through a community MCP connector, then Claude Haiku (via AI Gateway) writes the analysis. Both agents also run on their own Vercel Cron schedules.</p>
        </>
      }
    />
  );
}
