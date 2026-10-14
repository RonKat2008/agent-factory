"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Clock, Loader2, XCircle } from "lucide-react";
import type { Run, RunStatus, StepRun } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LABEL, PANEL, durationMs, fullTime, linkify, relTime, usd } from "./format";

function StatusIcon({ status }: { status: RunStatus }) {
  const c = "size-4 shrink-0";
  switch (status) {
    case "succeeded":
      return <CheckCircle2 className={cn(c, "text-emerald-600")} aria-label="succeeded" />;
    case "failed":
      return <XCircle className={cn(c, "text-red-600")} aria-label="failed" />;
    case "awaiting_approval":
      return <Clock className={cn(c, "text-amber-600")} aria-label="awaiting approval" />;
    case "running":
      return <Loader2 className={cn(c, "animate-spin text-stone-500")} aria-label="running" />;
    default:
      return <XCircle className={cn(c, "text-stone-400")} aria-label={status} />;
  }
}

function Json({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  if (value === null || value === undefined) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-stone-500 hover:text-stone-900"
      >
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} aria-hidden />
        {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-48 overflow-auto rounded-[3px] border border-stone-200 bg-white p-2 font-mono text-[11px] leading-snug text-stone-700">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

const STEP_CLS: Record<StepRun["status"], string> = {
  ok: "text-emerald-700",
  error: "text-red-700",
  skipped: "text-stone-500",
};

function RunDetail({ run }: { run: Run }) {
  return (
    <div className="flex flex-col gap-4 border-t border-stone-200 bg-white/60 px-3 py-3">
      {run.error && <p className="whitespace-pre-wrap font-mono text-[12px] text-red-700">{run.error}</p>}

      {run.steps && run.steps.length > 0 && (
        <div>
          <h4 className={cn(LABEL, "mb-1.5")}>Step trace</h4>
          <ol className="flex flex-col gap-2">
            {run.steps.map((s) => (
              <li key={s.idx} className="rounded-[3px] border border-stone-200 bg-[#FBFAF7] p-2">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[12px] tabular-nums">
                  <span className="text-stone-400">{s.idx}</span>
                  <span className="text-stone-900">{s.stepId}</span>
                  <span className="rounded-[3px] border border-stone-300 bg-stone-100 px-1 text-[10px] uppercase text-stone-600">
                    {s.block}
                  </span>
                  <span className={cn("uppercase text-[11px]", STEP_CLS[s.status])}>{s.status}</span>
                  {s.ms != null && <span className="ml-auto text-stone-500">{s.ms}ms</span>}
                </div>
                {s.error && <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[12px] text-red-700">{s.error}</p>}
                <div className="mt-1 flex flex-wrap gap-x-4">
                  <Json label="input" value={s.input} />
                  <Json label="output" value={s.output} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {run.tests && run.tests.length > 0 && (
        <div>
          <h4 className={cn(LABEL, "mb-1.5")}>Test results</h4>
          <ul className="flex flex-col gap-1">
            {run.tests.map((t) => (
              <li key={t.testIndex} className="flex items-start gap-2 text-[12px]">
                {t.passed ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-label="passed" />
                ) : (
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-600" aria-label="failed" />
                )}
                <span className="font-mono">{t.kind}</span>
                {t.detail && <span className="text-stone-500">{t.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.output && (
        <div>
          <h4 className={cn(LABEL, "mb-1.5")}>Output</h4>
          <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-stone-900">
            {linkify(run.output.message)}
          </p>
          {run.output.citations.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 text-[12px]">
              {run.output.citations.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-stone-400">[{i + 1}]</span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
                  >
                    {c.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!run.output && !run.error && !run.steps?.length && <p className="text-[12px] text-stone-500">No details recorded.</p>}
    </div>
  );
}

function RunRow({ run, open, onToggle }: { run: Run; open: boolean; onToggle: () => void }) {
  return (
    <li id={`run-${run.id}`} className="scroll-mt-4 border-b border-stone-200 last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-stone-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-900/40",
          open && "bg-stone-100/70",
        )}
      >
        <ChevronRight className={cn("size-3.5 shrink-0 text-stone-400 transition-transform", open && "rotate-90")} aria-hidden />
        <StatusIcon status={run.status} />
        <span
          className={cn(
            "rounded-[3px] border px-1.5 py-0.5 font-mono text-[11px]",
            run.kind === "repair_test"
              ? "border-violet-300 bg-violet-50 text-violet-800"
              : "border-stone-300 bg-stone-100 text-stone-700",
          )}
        >
          {run.kind}
        </span>
        <span className="font-mono text-[12px] tabular-nums text-stone-600">v{run.version}</span>
        <span className="ml-auto flex items-center gap-4 font-mono text-[12px] tabular-nums text-stone-500">
          <span className="hidden sm:inline">{durationMs(run.startedAt, run.finishedAt)}</span>
          <span className="hidden sm:inline">{usd(run.costUsd)}</span>
          <span title={fullTime(run.startedAt)}>{relTime(run.startedAt)}</span>
        </span>
      </button>
      {open && <RunDetail run={run} />}
    </li>
  );
}

export type RunFocus = { id: string; nonce: number } | null;

export function RunTimeline({ runs, focus }: { runs: Run[]; focus: RunFocus }) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  // Opens and scrolls to a run when the run strip is clicked.
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      setOpenIds((prev) => new Set(prev).add(focus.id));
      // Wait a frame so the row has expanded before measuring its position.
      requestAnimationFrame(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document
          .getElementById(`run-${focus.id}`)
          ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      });
    }, 0);
    return () => clearTimeout(t);
  }, [focus]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className={PANEL} aria-label="Run timeline">
      <h2 className={cn(LABEL, "border-b border-stone-300 px-3 py-2.5")}>Run timeline</h2>
      {runs.length === 0 ? (
        <p className="px-3 py-4 text-[13px] text-stone-500">No runs yet. Hit “Run now” to see one.</p>
      ) : (
        <ul>
          {runs.map((r) => (
            <RunRow key={r.id} run={r} open={openIds.has(r.id)} onToggle={() => toggle(r.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}
