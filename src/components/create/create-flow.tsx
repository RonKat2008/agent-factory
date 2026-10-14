"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Power, RotateCcw, Send } from "lucide-react";
import { track } from "@vercel/analytics";
import {
  createAgent,
  getAgent,
  getAgentSettings,
  getFeed,
  goLive,
  saveAgentSettings,
  sendTest,
} from "@/lib/api-client";
import type { AgentDetail, FeedEvent } from "@/lib/types";
import { HomeBuilder } from "@/components/home/home-builder";
import { Stepper, type StepIndex } from "./stepper";
import { PlanStep } from "./plan-step";
import { PreviewStep } from "./preview-step";
import { SendTo, SLACK_WEBHOOK_RE, TEAM_CHANNEL, type Destination } from "./send-to";
import { TechDetails } from "./tech-details";
import { ConnectSlackButton, SignInWithSlack, SlackOAuthNotice, useMe } from "@/components/slack-connect";
import { type SchedulePick, describePick, pickToUtcCron, utcCronToPick } from "./schedule";
import { MOCK_AGENT_ID, MOCK_MODE, simulateSnapshot } from "./simulate";

const POLL_MS = MOCK_MODE ? 400 : 2000;
const byTime = (a: FeedEvent, b: FeedEvent) => a.createdAt.localeCompare(b.createdAt);
const BTN_BIG =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[4px] px-5 text-[15px] font-medium transition-[background-color,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/60 disabled:cursor-not-allowed disabled:opacity-50";
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function progressText(detail: AgentDetail | null, events: FeedEvent[]): string {
  const status = detail?.agent.status ?? "building";
  const fixes = events.filter((e) => e.type === "self_fixed").length;
  const fixed = fixes > 0 ? ` Found ${fixes === 1 ? "a problem" : `${fixes} problems`} and fixed ${fixes === 1 ? "it" : "them"}.` : "";
  if (status === "ready" || status === "live") return `Done. It passed every check.${fixed}`;
  if (status === "testing" || events.some((e) => e.type === "dry_run")) return `Testing it on real data…${fixed}`;
  if (detail?.agent.plan) return "Building your agent…";
  return "Reading your request…";
}

export function CreateFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const requestParam = params.get("request");
  const [agentId, setAgentId] = useState<string | null>(() => params.get("agent"));
  const [request, setRequest] = useState(requestParam ?? "");
  const [startError, setStartError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [pollError, setPollError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const started = useRef<string | null>(null);

  // ?step=3 (back from "Sign in with Slack") resumes at the send step.
  const [confirmed, setConfirmed] = useState(() => params.get("step") === "3");
  const [draftPick, setDraftPick] = useState<SchedulePick | null>(null);
  const [destination, setDestination] = useState<Destination>("team");
  const [webhook, setWebhook] = useState("");
  const [hasSavedWebhook, setHasSavedWebhook] = useState(false);
  const [busy, setBusy] = useState<null | "continue" | "test" | "on">(null);
  const { me } = useMe();
  const mySlack = me?.slack ?? null;
  // Signed in with Slack: "your Slack" replaces the team channel as the default.
  const dest: Destination = destination === "team" && mySlack ? "mine" : destination === "mine" && !mySlack ? "team" : destination;

  const status = detail?.agent.status ?? "building";
  const terminal = status === "ready" || status === "live" || status === "needs_human";

  // Start a build from /new?request=… once per request, then swap the URL to ?agent=<id> so a refresh resumes it.
  useEffect(() => {
    const text = requestParam?.trim();
    if (!text || started.current === text) return;
    // No cancellation on cleanup: the ref guard makes this run once per request (also under Strict Mode's
    // double effect), so the one in-flight create must be allowed to land.
    started.current = text;
    (async () => {
      track("agent_build_started");
      try {
        const id = MOCK_MODE ? MOCK_AGENT_ID : (await createAgent(text)).agentId;
        setRequest(text);
        setDetail(null);
        setEvents([]);
        setConfirmed(false);
        setDraftPick(null);
        setStartedAt(Date.now());
        setAgentId(id);
        setStartError(null);
        router.replace(`/new?agent=${id}`, { scroll: false });
      } catch (e) {
        started.current = null;
        setStartError(errText(e, "Could not start building your agent"));
      }
    })();
  }, [requestParam, router]);

  const load = useCallback(async () => {
    if (!agentId) return;
    const snap = MOCK_MODE
      ? await simulateSnapshot(startedAt)
      : await Promise.all([getAgent(agentId), getFeed({ agentId })]).then(([d, ev]) => (d ? { detail: d, events: ev } : null));
    if (!snap) return;
    setDetail(snap.detail);
    setEvents([...snap.events].sort(byTime));
    setPollError(null);
  }, [agentId, startedAt]);

  useEffect(() => {
    if (!agentId || terminal) return;
    let alive = true;
    const tick = () =>
      load().catch((e) => {
        if (alive) setPollError(errText(e, "Lost contact with the factory"));
      });
    void tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [agentId, terminal, load]);

  // Entering the preview step: pick up a webhook saved earlier for this agent.
  useEffect(() => {
    if (!agentId || !confirmed) return;
    let alive = true;
    getAgentSettings(agentId)
      .then((s) => {
        if (!alive || !s.hasOwnSlack) return;
        setHasSavedWebhook(true);
        setDestination("own");
      })
      .catch(() => {
        /* settings are optional; team channel stays the default */
      });
    return () => {
      alive = false;
    };
  }, [agentId, confirmed]);

  const active = detail?.versions.find((v) => v.version === detail.agent.currentVersion) ?? detail?.versions[0] ?? null;
  const spec = active?.spec ?? null;
  const basePick = spec ? utcCronToPick(spec.schedule) : null;
  const pick = draftPick ?? basePick;
  const dryRun = detail?.runs.find((r) => r.kind === "dry_run" && r.status !== "running") ?? null;
  const name = detail?.agent.name && detail.agent.name !== "New agent" ? detail.agent.name : "Your agent";
  const ready = status === "ready";

  const continueToPreview = async () => {
    if (!agentId || busy) return;
    setBusy("continue");
    try {
      if (draftPick && spec && pickToUtcCron(draftPick) !== spec.schedule && !MOCK_MODE) {
        await saveAgentSettings(agentId, { schedule: pickToUtcCron(draftPick) });
        toast.success(`Schedule saved: ${lowerFirst(describePick(draftPick))}`);
        await load();
      }
      setDraftPick(null);
      setConfirmed(true);
    } catch (e) {
      toast.error(errText(e, "Couldn't save the schedule"));
    } finally {
      setBusy(null);
    }
  };

  /** Saves the chosen destination. Returns false (with a toast) when the user still has to paste a webhook. */
  const applyDestination = async (): Promise<boolean> => {
    if (!agentId) return false;
    const url = webhook.trim();
    if (dest === "own") {
      if (!url) {
        if (hasSavedWebhook) return true;
        toast.error("Paste your Slack webhook URL first, or choose the team channel.");
        return false;
      }
      if (!SLACK_WEBHOOK_RE.test(url)) {
        toast.error("That isn't a Slack webhook URL. It starts with https://hooks.slack.com/services/");
        return false;
      }
      await saveAgentSettings(agentId, { slackWebhook: url });
      setHasSavedWebhook(true);
      setWebhook("");
      return true;
    }
    if (hasSavedWebhook) {
      await saveAgentSettings(agentId, { slackWebhook: null });
      setHasSavedWebhook(false);
    }
    return true;
  };

  const where = dest === "own" ? "your Slack channel" : dest === "mine" && mySlack ? `#${mySlack.channel}` : `#${TEAM_CHANNEL}`;

  const testNow = async () => {
    if (!agentId || busy) return;
    setBusy("test");
    try {
      if (!(await applyDestination())) return;
      await sendTest(agentId);
      track("agent_test_send");
      toast.success(`Test sent to ${where}. Go take a look.`);
    } catch (e) {
      toast.error(errText(e, "Couldn't send the test"));
    } finally {
      setBusy(null);
    }
  };

  const turnOn = async () => {
    if (!agentId || busy) return;
    setBusy("on");
    try {
      if (!(await applyDestination())) {
        setBusy(null);
        return;
      }
      if (!MOCK_MODE) await goLive(agentId);
      track("agent_go_live");
      toast.success(`Your agent is on. It will message ${where} ${pick ? lowerFirst(describePick(pick)) : "on schedule"}.`);
      router.push(`/agents/${agentId}`);
    } catch (e) {
      toast.error(errText(e, "Couldn't turn it on"));
      setBusy(null);
    }
  };

  const startOver = () => {
    started.current = null;
    setAgentId(null);
    setDetail(null);
    setEvents([]);
    setConfirmed(false);
    setStartError(null);
    router.push("/new");
  };

  const step: StepIndex = !agentId ? 0 : confirmed && (ready || status === "live") ? 2 : 1;
  const shownRequest = request || detail?.agent.request || "";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-2 sm:py-4">
      <Stepper current={step} />

      {step === 0 &&
        (requestParam && !startError ? (
          <p className="flex items-center gap-2 py-10 text-[16px] text-stone-700">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Starting your agent…
          </p>
        ) : (
          <div className="py-2 sm:py-6">
            {startError && (
              <p role="alert" className="mb-5 rounded-[4px] border border-red-300 bg-red-50 px-3 py-2 text-[14px] text-red-800">
                {startError}
              </p>
            )}
            <HomeBuilder initial={requestParam ?? request} />
          </div>
        ))}

      {step > 0 && shownRequest && (
        <blockquote className="border-l-4 border-violet-700 pl-4 text-[clamp(20px,2.6vw,26px)] font-medium leading-snug text-stone-900">
          “{shownRequest}”
        </blockquote>
      )}

      {step === 1 && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[15px] text-stone-700" aria-live="polite">
            {!terminal && <Loader2 className="size-4 animate-spin text-violet-700" aria-hidden />}
            {status !== "needs_human" && <span>{progressText(detail, events)}</span>}
            {pollError && <span className="text-[13px] text-amber-700">Reconnecting…</span>}
          </div>

          {status === "needs_human" ? (
            <div className="flex flex-col gap-3 rounded-[6px] border border-red-300 bg-red-50 p-4">
              <p className="text-[15px] font-medium text-red-900">We couldn’t get this agent to pass its checks.</p>
              <p className="text-[14px] text-red-900/80">
                Try describing it a little differently, for example name the website or the exact thing you want to hear about.
              </p>
              <button type="button" onClick={startOver} className={`${BTN_BIG} w-fit border border-red-300 bg-white text-red-900 hover:bg-red-100`}>
                <RotateCcw className="size-4" aria-hidden /> Try again
              </button>
            </div>
          ) : (
            <>
              <PlanStep plan={detail?.agent.plan ?? spec?.plan ?? null} spec={spec} pick={pick} onPick={setDraftPick} canEdit={ready} />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={continueToPreview}
                  disabled={!ready || busy !== null}
                  className={`${BTN_BIG} bg-stone-900 text-[#F6F4EF] hover:bg-violet-700`}
                >
                  {busy === "continue" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Looks good, show me the message
                </button>
                {!ready && <span className="text-[13px] text-stone-500">Usually takes under a minute. Nothing is sent while we build.</span>}
              </div>
            </>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <PreviewStep
            name={name}
            spec={spec}
            run={dryRun}
            events={events}
            channel={dest === "own" ? "your-channel" : dest === "mine" && mySlack ? mySlack.channel : TEAM_CHANNEL}
            time={pick ? describePick(pick).replace(/^.* at /, "") : "9:00 AM"}
          />
          <div className="grid gap-5 rounded-[6px] border border-stone-300 bg-[#FBFAF7] p-4 sm:p-5">
            <SlackOAuthNotice />
            <SendTo
              destination={dest}
              mySlack={mySlack}
              slackSlot={
                agentId && me ? (
                  mySlack ? (
                    <ConnectSlackButton agentId={agentId} returnTo={`/new?agent=${agentId}&step=3`} />
                  ) : (
                    <div className="flex flex-col items-start gap-1.5">
                      <SignInWithSlack size="lg" agentId={agentId} returnTo={`/new?agent=${agentId}&step=3`} isConfigured={me.slackOAuth.configured} />
                      <p className="text-[12.5px] text-stone-500">
                        {me.slackOAuth.configured ? "One click: sign in and pick the channel. Or choose below." : "Pick one of these for now."}
                      </p>
                    </div>
                  )
                ) : null
              }
              onDestination={setDestination}
              webhook={webhook}
              onWebhook={setWebhook}
              hasSavedWebhook={hasSavedWebhook}
              disabled={busy !== null}
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4">
              <button type="button" onClick={testNow} disabled={busy !== null} className={`${BTN_BIG} border border-stone-900 bg-white text-stone-900 hover:bg-stone-100`}>
                {busy === "test" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                Send me a test now
              </button>
              {status === "live" ? (
                <Link href={`/agents/${agentId}`} className={`${BTN_BIG} bg-emerald-700 text-white hover:bg-emerald-800`}>
                  It’s on. Open your agent
                </Link>
              ) : (
                <button type="button" onClick={turnOn} disabled={busy !== null} className={`${BTN_BIG} bg-stone-900 text-[#F6F4EF] hover:bg-violet-700`}>
                  {busy === "on" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Power className="size-4" aria-hidden />}
                  Turn on
                </button>
              )}
              <span className="text-[13px] text-stone-500">
                {pick ? `${describePick(pick)}. ` : ""}You can pause it any time.
              </span>
            </div>
          </div>
          <button type="button" onClick={() => setConfirmed(false)} className="inline-flex w-fit items-center gap-1.5 text-[13px] text-stone-600 hover:text-stone-900">
            <ArrowLeft className="size-3.5" aria-hidden /> Back to the plan
          </button>
        </>
      )}

      {step > 0 && <TechDetails events={events} active={!terminal} spec={spec} run={dryRun} />}
    </div>
  );
}
