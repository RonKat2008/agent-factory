"use client";
import { useState } from "react";
import { AlertTriangle, Loader2, Pause, Play, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { approveRun, editAgent, runNow, setApproval, setPaused } from "@/lib/api-client";
import type { Agent, Run } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentEvents } from "./agent-events";
import { BTN_PRIMARY, BTN_SECONDARY, LABEL, PANEL, linkify } from "./format";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function SteeringPanel({ agent, runs, onChanged }: { agent: Agent; runs: Run[]; onChanged: () => void }) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const awaiting = runs.find((r) => r.status === "awaiting_approval");
  const paused = agent.status === "paused";

  async function act<T>(key: string, fn: () => Promise<T>, ok: (r: T) => string) {
    setBusy(key);
    try {
      const r = await fn();
      toast.success(ok(r));
      onChanged();
      return true;
    } catch (e) {
      toast.error(msg(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    const text = instruction.trim();
    if (!text) return;
    const done = await act("edit", () => editAgent(agent.id, text), (r) => `v${r.version} created — re-testing…`);
    if (done) setInstruction("");
  }

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
      {awaiting && (
        <section className="rounded-[3px] border border-amber-400 bg-amber-50 p-3" aria-label="Approval needed">
          <h2 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-amber-800">
            <AlertTriangle className="size-3.5" aria-hidden /> Waiting for your approval
          </h2>
          <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[13px] text-stone-900">
            {awaiting.output ? linkify(awaiting.output.message) : "No preview available."}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className={BTN_PRIMARY}
              disabled={busy !== null}
              onClick={() => act("approve", () => approveRun(awaiting.id, true), () => "Approved — sending")}
            >
              {busy === "approve" && <Loader2 className="size-3.5 animate-spin" />} Approve
            </button>
            <button
              className={BTN_SECONDARY}
              disabled={busy !== null}
              onClick={() => act("reject", () => approveRun(awaiting.id, false), () => "Rejected — nothing sent")}
            >
              Reject
            </button>
          </div>
        </section>
      )}

      <section className={cn(PANEL, "flex flex-col gap-3 p-3")} aria-label="Steer this agent">
        <h2 className={LABEL}>Edit in plain English</h2>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          placeholder="e.g. Only post stories with 100+ points"
          className="w-full resize-y rounded-[3px] border border-stone-300 bg-white p-2 text-[13px] text-stone-900 placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
        />
        <button className={BTN_PRIMARY} disabled={busy !== null || !instruction.trim()} onClick={apply}>
          {busy === "edit" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {busy === "edit" ? "Applying…" : "Apply edit"}
        </button>

        <div className="flex gap-2 border-t border-stone-200 pt-3">
          <button
            className={cn(BTN_SECONDARY, "flex-1")}
            disabled={busy !== null || agent.currentVersion == null}
            onClick={() => act("run", () => runNow(agent.id), () => "Run started")}
          >
            {busy === "run" ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />} Run now
          </button>
          <button
            className={cn(BTN_SECONDARY, "flex-1")}
            disabled={busy !== null}
            onClick={() =>
              act("pause", () => setPaused(agent.id, !paused), () => (paused ? "Agent resumed" : "Agent paused"))
            }
          >
            {busy === "pause" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : paused ? (
              <Play className="size-3.5" />
            ) : (
              <Pause className="size-3.5" />
            )}
            {paused ? "Resume" : "Pause"}
          </button>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px] text-stone-900">
          Require approval before sending
          <button
            type="button"
            role="switch"
            aria-checked={agent.requiresApproval}
            disabled={busy !== null}
            onClick={() =>
              act(
                "approval",
                () => setApproval(agent.id, !agent.requiresApproval),
                () => (agent.requiresApproval ? "Approval no longer required" : "Approval required before sending"),
              )
            }
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40 disabled:opacity-50",
              agent.requiresApproval ? "border-stone-900 bg-stone-900" : "border-stone-300 bg-stone-200",
            )}
          >
            <span
              className={cn(
                "absolute left-0.5 top-0.5 size-3.5 rounded-full bg-[#FBFAF7] transition-transform",
                agent.requiresApproval && "translate-x-4",
              )}
            />
          </button>
        </label>
      </section>

      <section className={cn(PANEL, "p-3")}>
        <AgentEvents agentId={agent.id} />
      </section>
    </aside>
  );
}
