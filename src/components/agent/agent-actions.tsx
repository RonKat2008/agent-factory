"use client";
import { useState } from "react";
import { Loader2, Pause, Play, Zap } from "lucide-react";
import { toast } from "sonner";
import { track } from "@vercel/analytics";
import { runNow, setPaused } from "@/lib/api-client";
import type { Agent } from "@/lib/types";
import { motion } from "motion/react";
import { SPRING } from "@/components/motion";
import { BTN_PRIMARY, BTN_SECONDARY } from "./format";

/** Run now (primary) / Pause — the header action row. Export lives in the "More" overflow. */
export function AgentActions({ agent, onChanged }: { agent: Agent; onChanged: () => void }) {
  const [busy, setBusy] = useState<"run" | "pause" | null>(null);
  const paused = agent.status === "paused";

  async function act(key: "run" | "pause", fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <motion.button
        type="button"
        className={BTN_PRIMARY}
        whileTap={{ scale: 0.97 }}
        transition={SPRING.snappy}
        disabled={busy !== null || agent.currentVersion == null}
        onClick={() => act("run", () => runNow(agent.id).then(() => track("run_now")), "Run started")}
      >
        {busy === "run" ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />} Run now
      </motion.button>
      <button
        type="button"
        className={BTN_SECONDARY}
        disabled={busy !== null}
        onClick={() => act("pause", () => setPaused(agent.id, !paused), paused ? "Agent resumed" : "Agent paused")}
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
    </>
  );
}
