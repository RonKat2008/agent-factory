"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, MessageSquareText, Pencil, ThumbsDown } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/ui-tokens";
import { cn } from "@/lib/utils";
import { ChapterShell } from "./chapter-shell";
import { markLeavingTour } from "./chapters";
import { getTour } from "./tour-api";

const EDIT_EXAMPLE = "Only post releases that mention pricing or AI, and keep it to two sentences.";
const OPS_PROMPT = "Why did the Acme watcher break today and how was it fixed?";
export const OPS_OPEN_EVENT = "ops:open";

const EDIT_FLOW = [
  { label: "New version written", detail: "v3 changes the filter step and the summary length" },
  { label: "Tested on real data", detail: "all checks run again, including every past regression test" },
  { label: "Live only if it passes", detail: "otherwise v2 keeps running and you see why" },
];

/** undefined while loading, null if there is no watcher (link falls back to the fleet). */
function useWatcherId(): string | null | undefined {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    getTour().then((t) => alive && setId(t.watcher?.id ?? null)).catch(() => alive && setId(null));
    return () => { alive = false; };
  }, []);
  return id;
}

function SteerTry() {
  const watcherId = useWatcherId();
  const href = watcherId ? `/agents/${watcherId}#steer` : "/fleet";
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-[13.5px] text-stone-700">An example edit you could type:</p>
        <blockquote className="flex gap-2.5 rounded-[4px] border-2 border-stone-900 bg-white p-3 text-[15px] text-stone-900 shadow-[4px_4px_0_0_#1c1917]">
          <Pencil className="mt-1 size-4 shrink-0 text-stone-500" aria-hidden />
          {EDIT_EXAMPLE}
        </blockquote>
        <ol className="space-y-2">
          {EDIT_FLOW.map((s, i) => (
            <li key={s.label} className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-600 font-mono text-[11px] text-white">{i + 1}</span>
              <p className="text-[13.5px] leading-snug text-stone-800"><strong>{s.label}:</strong> {s.detail}</p>
            </li>
          ))}
        </ol>
        {watcherId === undefined ? (
          <span className={cn(BTN_PRIMARY, "h-10 px-4 opacity-60")} aria-busy="true">Open the watcher&apos;s edit box</span>
        ) : (
          <Link href={href} onClick={markLeavingTour} className={cn(BTN_PRIMARY, "h-10 px-4")}>
            Open the watcher&apos;s edit box <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <div className="space-y-3">
        <div className="rounded-[3px] border border-stone-300 bg-white p-3.5">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-stone-900"><Check className="size-4 text-emerald-600" aria-hidden /> Approvals</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-stone-600">Turn on &quot;Ask me before it posts&quot; and every run waits for your OK, right in the app.</p>
        </div>
        <div className="rounded-[3px] border border-stone-300 bg-white p-3.5">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-stone-900"><ThumbsDown className="size-4 text-red-600" aria-hidden /> Feedback becomes a fix</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-stone-600">Every Slack post has 👍 and 👎 links. A 👎 makes the factory propose a new version that addresses it, tested, waiting for you to accept.</p>
        </div>
      </div>
    </div>
  );
}

export function ChapterSteer() {
  return (
    <ChapterShell
      n={5}
      title="Steer it in plain English"
      lede={
        <p>
          You never edit code or a flowchart. Tell an agent what to change in a sentence, approve its posts before they go out, or tap 👎 on a bad Slack message. Each of these produces a new version that has to pass its tests before it replaces the old one.
        </p>
      }
      different={<p>Edits are safe by default. A change that breaks the agent never goes live: the old version keeps running and you see exactly which check failed.</p>}
      tryIt={<SteerTry />}
      products={["AI Gateway", "Workflow DevKit", "Neon"]}
      hood={
        <p>
          Claude Sonnet (via AI Gateway) rewrites the agent&apos;s plan from your instruction. A test-run workflow replays the new version on real data and checks it. Versions, approvals and feedback are rows in Neon, so every change has a diff and can be rolled back.
        </p>
      }
    />
  );
}

function OpsTry() {
  const open = () => window.dispatchEvent(new CustomEvent(OPS_OPEN_EVENT, { detail: { prompt: OPS_PROMPT } }));
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={open} className={cn(BTN_PRIMARY, "h-11 px-5 text-[15px]")}>
          <MessageSquareText className="size-4" aria-hidden /> Ask Fleet Ops
        </button>
        <p className="text-[13.5px] text-stone-600">Asks: &ldquo;{OPS_PROMPT}&rdquo;</p>
      </div>
      <p className="rounded-[3px] border border-stone-300 bg-white px-3.5 py-3 text-[13.5px] leading-relaxed text-stone-700">
        Fleet Ops is a separate <strong>eve</strong> agent deployed on Vercel. It can look things up freely, but it asks before changing anything: pausing, running or editing an agent shows an approval card first. Open it any time with <kbd className="rounded-[2px] border border-stone-300 bg-stone-100 px-1 font-mono text-[11px]">⌘K</kbd> or the Ask Ops button in the top bar.
      </p>
      <Link href="/fleet" onClick={markLeavingTour} className={cn(BTN_SECONDARY, "h-9 w-fit")}>See the whole fleet <ArrowRight className="size-3.5" aria-hidden /></Link>
    </div>
  );
}

export function ChapterOps() {
  return (
    <ChapterShell
      n={6}
      title="Ask your fleet"
      lede={<p>When you run many agents, you need a way to ask questions across all of them. Fleet Ops answers in plain English using real run history: what broke, why, what it cost, and what each agent learned.</p>}
      different={<p>It is an agent that manages agents, and it is built on a different stack: a standalone eve project with its own tools, talking to this app&apos;s API. Any change it wants to make needs your click.</p>}
      tryIt={<OpsTry />}
      products={["eve", "AI Gateway", "Fluid compute"]}
      hood={
        <p>
          The chat streams from an eve agent deployed as its own Vercel project. Its tools call this app&apos;s API (list agents, read the feed, get stats, run, pause, edit). Write tools are approval-gated, so the eve session pauses until you approve or decline in the panel.
        </p>
      }
    />
  );
}
