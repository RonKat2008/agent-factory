"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw, Rocket } from "lucide-react";
import { createAgent, getAgent, getFeed, goLive } from "@/lib/api-client";
import type { AgentDetail, FeedEvent } from "@/lib/types";
import { BTN_PRIMARY, BTN_SECONDARY, LABEL } from "@/components/ui-tokens";
import { StatusPill } from "@/components/status-pill";
import { PromptStage } from "./prompt-stage";
import { PlanCard } from "./plan-card";
import { BuildLog } from "./build-log";
import { MOCK_AGENT_ID, MOCK_MODE, simulateSnapshot } from "./simulate";

const POLL_MS = MOCK_MODE ? 400 : 2000;
const byTime = (a: FeedEvent, b: FeedEvent) => a.createdAt.localeCompare(b.createdAt);

export function CreateFlow() {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [pollError, setPollError] = useState<string | null>(null);
  const [going, setGoing] = useState(false);

  const status = detail?.agent.status ?? "building";
  const terminal = status === "ready" || status === "live" || status === "needs_human";

  useEffect(() => {
    if (!agentId || terminal) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const snap = MOCK_MODE
          ? await simulateSnapshot(startedAt)
          : await Promise.all([getAgent(agentId), getFeed({ agentId })]).then(([d, ev]) =>
              d ? { detail: d, events: ev } : null,
            );
        if (cancelled || !snap) return;
        setDetail(snap.detail);
        setEvents([...snap.events].sort(byTime));
        setPollError(null);
      } catch (err) {
        if (!cancelled) setPollError(err instanceof Error ? err.message : "Lost contact with the factory");
      }
    };
    void tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [agentId, startedAt, terminal]);

  const submit = useCallback(async () => {
    const text = request.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const id = MOCK_MODE ? MOCK_AGENT_ID : (await createAgent(text)).agentId;
      setDetail(null);
      setEvents([]);
      setStartedAt(Date.now());
      setAgentId(id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not start the build");
    } finally {
      setSubmitting(false);
    }
  }, [request, submitting]);

  const retry = () => {
    setAgentId(null);
    setDetail(null);
    setEvents([]);
    setPollError(null);
  };

  const publish = async () => {
    if (!agentId || going) return;
    setGoing(true);
    try {
      if (!MOCK_MODE) await goLive(agentId);
      toast.success("Agent is live");
      router.push(`/agents/${agentId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not go live");
      setGoing(false);
    }
  };

  if (!agentId) {
    return (
      <div className="px-4 py-8 sm:px-8 sm:py-14">
        <PromptStage value={request} onChange={setRequest} onSubmit={submit} pending={submitting} error={submitError} />
      </div>
    );
  }

  const spec = detail?.versions[0]?.spec ?? null;
  const lastError = [...events].reverse().find((e) => e.type === "needs_human" || e.type === "test_failed");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <p className={LABEL}>New agent / 02 build</p>
      <blockquote className="mt-2 border-l-2 border-stone-900 pl-4 text-xl font-medium leading-snug text-stone-900 sm:text-2xl">
        “{request.trim()}”
      </blockquote>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StatusPill status={status} />
        <span className="font-mono text-[11px] text-stone-500">{agentId.slice(0, 8)}</span>
        {pollError && <span className="text-[12px] text-amber-700">Reconnecting… {pollError}</span>}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PlanCard plan={detail?.agent.plan ?? null} spec={spec} />
        <BuildLog events={events} active={!terminal} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {status === "ready" && (
          <>
            <button
              type="button"
              onClick={publish}
              disabled={going}
              className={`${BTN_PRIMARY} h-10 px-6 text-[14px]`}
            >
              {going ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
              {going ? "Going live…" : "Go live"}
            </button>
            <span className="text-[13px] text-stone-500">All tests passed. Nothing runs on a schedule until you go live.</span>
          </>
        )}
        {status === "needs_human" && (
          <div className="flex w-full flex-col gap-3 border border-red-300 bg-red-50 p-3 rounded-[3px]">
            <p className="font-mono text-[12.5px] text-red-900">
              {lastError?.message ?? "The factory could not make this pass its tests."}
            </p>
            <button
              type="button"
              onClick={retry}
              className={`${BTN_SECONDARY} w-fit`}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Try again
            </button>
          </div>
        )}
        {(status === "building" || status === "testing") && (
          <span className="text-[13px] text-stone-500">The factory is building and testing. This usually takes under a minute.</span>
        )}
      </div>
    </div>
  );
}
