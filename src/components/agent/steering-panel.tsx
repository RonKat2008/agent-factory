"use client";
import { useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { track } from "@vercel/analytics";
import { approveRun, editAgent, setApproval } from "@/lib/api-client";
import type { Agent, Run } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Term } from "@/components/explain";
import { AgentEvents } from "./agent-events";
import { BTN_PRIMARY, BTN_SECONDARY, PANEL, linkify } from "./format";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function SteeringPanel({ agent, runs, onChanged }: { agent: Agent; runs: Run[]; onChanged: () => void }) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const awaiting = runs.find((r) => r.status === "awaiting_approval");

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
    const done = await act("edit", () => editAgent(agent.id, text), (r) => `Testing your change (v${r.version})…`);
    if (done) {
      track("edit_applied");
      setInstruction("");
    }
  }

  return (
    <aside className="flex flex-col gap-5 lg:sticky lg:top-4 lg:self-start">
      {awaiting && (
        <section className="rounded-[3px] border border-amber-400 bg-amber-50 p-3" aria-label="Approval needed">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-amber-900">
            <AlertTriangle className="size-3.5" aria-hidden /> Waiting for your OK
          </h2>
          <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[13px] text-stone-900">
            {awaiting.output ? linkify(awaiting.output.message) : "No preview available."}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className={BTN_PRIMARY}
              disabled={busy !== null}
              onClick={() => act("approve", () => approveRun(awaiting.id, true), () => "Sent")}
            >
              {busy === "approve" && <Loader2 className="size-3.5 animate-spin" />} Send it
            </button>
            <button
              className={BTN_SECONDARY}
              disabled={busy !== null}
              onClick={() => act("reject", () => approveRun(awaiting.id, false), () => "Not sent")}
            >
              Don&rsquo;t send
            </button>
          </div>
        </section>
      )}

      <section id="steer" className={cn(PANEL, "flex scroll-mt-24 flex-col gap-3.5 p-4")} aria-label="Change what it does">
        <div className="flex flex-col gap-1">
          <h2 className="text-[16px] font-semibold tracking-tight text-stone-900">Change what it does</h2>
          <p className="text-[13px] leading-snug text-stone-500">
            Say it in your own words. We test the change first and only switch over if every check passes.
          </p>
        </div>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          aria-label="Change what it does"
          placeholder="e.g. Only include posts with 100+ points"
          className="min-h-[88px] w-full resize-y rounded-[3px] border border-stone-300 bg-white p-2.5 text-[15px] text-stone-900 placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
        />
        <button className={instruction.trim() ? BTN_PRIMARY : BTN_SECONDARY} disabled={busy !== null || !instruction.trim()} onClick={apply}>
          {busy === "edit" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {busy === "edit" ? "Testing…" : "Test and apply"}
        </button>

        <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-3 text-[13px] text-stone-900">
          <span>
            <Term id="approval">Ask me before it posts</Term>
          </span>
          <button
            type="button"
            role="switch"
            aria-label="Ask me before it posts"
            aria-checked={agent.requiresApproval}
            disabled={busy !== null}
            onClick={() =>
              act(
                "approval",
                () => setApproval(agent.id, !agent.requiresApproval),
                () => (agent.requiresApproval ? "It will post without asking" : "It will ask you before posting"),
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
        </div>
      </section>

      <section className={cn(PANEL, "p-3")}>
        <AgentEvents agentId={agent.id} />
      </section>
    </aside>
  );
}
