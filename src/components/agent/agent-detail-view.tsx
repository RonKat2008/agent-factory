"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAgent } from "@/lib/api-client";
import type { AgentDetail } from "@/lib/types";
import { AgentHeader } from "./agent-header";
import { LatestOutput } from "./latest-output";
import { RunStrip } from "./run-strip";
import { RunTimeline, type RunFocus } from "./run-timeline";
import { SteeringPanel } from "./steering-panel";
import { VersionHistory } from "./version-history";

const POLL_MS = 3000;

function Skeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading agent">
      <div className="h-9 w-72 animate-pulse rounded-[3px] bg-stone-200" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-[3px] bg-stone-200" />
      <div className="h-20 animate-pulse rounded-[3px] bg-stone-200" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="h-64 animate-pulse rounded-[3px] bg-stone-200" />
          <div className="h-40 animate-pulse rounded-[3px] bg-stone-200" />
        </div>
        <div className="h-80 animate-pulse rounded-[3px] bg-stone-200" />
      </div>
    </div>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md border border-stone-300 bg-[#FBFAF7] p-6 text-center">
      <p className="font-mono text-[40px] leading-none tabular-nums text-stone-900">404</p>
      <p className="mt-3 text-[14px] text-stone-900">No agent with that id.</p>
      <p className="mt-1 break-all font-mono text-[11px] text-stone-500">{id}</p>
      <Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-sky-700 underline underline-offset-2">
        <ArrowLeft className="size-3.5" /> Back to fleet
      </Link>
    </div>
  );
}

export function AgentDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<AgentDetail | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<RunFocus>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await getAgent(id));
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load";
      if (/^404\b|not found/i.test(message)) setDetail(null);
      else setError(message); // keep last good data
    }
  }, [id]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  if (detail === undefined) {
    return error ? (
      <p role="alert" className="text-[13px] text-red-700">
        Couldn’t load agent: {error}
      </p>
    ) : (
      <Skeleton />
    );
  }
  if (detail === null) return <NotFound id={id} />;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Fleet
      </Link>
      {error && (
        <p role="alert" className="text-[12px] text-red-700">
          Connection issue ({error}) — showing last known state.
        </p>
      )}
      <AgentHeader agent={detail.agent} versions={detail.versions} onChanged={() => void load()} />
      <RunStrip runs={detail.runs} onSelect={(runId) => setFocus({ id: runId, nonce: Date.now() })} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <LatestOutput runs={detail.runs} agentName={detail.agent.name} />
          <VersionHistory agentId={id} versions={detail.versions} currentVersion={detail.agent.currentVersion} onChanged={() => void load()} />
          <RunTimeline runs={detail.runs} focus={focus} />
        </div>
        <div className="min-w-0">
          <SteeringPanel agent={detail.agent} runs={detail.runs} onChanged={() => void load()} />
        </div>
      </div>
    </div>
  );
}
