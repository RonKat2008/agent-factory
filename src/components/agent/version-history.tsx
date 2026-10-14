"use client";
import { useMemo, useState } from "react";
import { ChevronRight, FlaskConical, Loader2, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { track } from "@vercel/analytics";
import { acceptVersion, rejectVersion } from "@/lib/api-client";
import type { AgentTest, AgentVersion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { DURATION, EASE, FadeIn, Pulse, SPRING, Stagger, StaggerItem } from "@/components/motion";
import { Term } from "@/components/explain";
import { collapseDiff, diffLines, diffStats } from "./diff";
import { BTN_PRIMARY, BTN_SECONDARY, PANEL, fullTime, relTime } from "./format";

const STATUS_CLS: Record<AgentVersion["status"], string> = {
  active: "border-emerald-300 bg-emerald-50 text-emerald-800",
  proposed: "border-amber-300 bg-amber-50 text-amber-900",
  rejected: "border-stone-300 bg-stone-100 text-stone-500 line-through",
};

const STATUS_LABEL: Record<AgentVersion["status"], string> = {
  active: "current",
  proposed: "suggested",
  rejected: "not used",
};

const testKey = (t: AgentTest) => JSON.stringify([t.kind, t.config ?? null]);

function DiffView({ version, parent }: { version: AgentVersion; parent: AgentVersion }) {
  const { rows, added, removed } = useMemo(() => {
    const ops = diffLines(JSON.stringify(parent.spec, null, 2), JSON.stringify(version.spec, null, 2));
    return { rows: collapseDiff(ops), ...diffStats(ops) };
  }, [version, parent]);
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 font-mono text-[11px] tabular-nums text-stone-500">
        <span>
          v{parent.version} → v{version.version}
        </span>
        <span className="text-emerald-700">+{added}</span>
        <span className="text-red-700">−{removed}</span>
      </div>
      <pre className="max-h-[420px] overflow-auto rounded-[3px] border border-stone-300 bg-white py-1 font-mono text-[12px] leading-[1.55]">
        {rows.map((r, i) =>
          r.type === "gap" ? (
            <div key={i} className="bg-stone-100 px-3 py-0.5 text-stone-500">
              … {r.count} unchanged line{r.count === 1 ? "" : "s"}
            </div>
          ) : (
            <div
              key={i}
              className={cn(
                "whitespace-pre px-3",
                r.type === "add" && "bg-emerald-100/80 text-emerald-950",
                r.type === "del" && "bg-red-100/80 text-red-950",
                r.type === "same" && "text-stone-600",
              )}
            >
              <span className="mr-2 inline-block w-2 select-none text-stone-400">
                {r.type === "add" ? "+" : r.type === "del" ? "-" : " "}
              </span>
              {r.text}
            </div>
          ),
        )}
      </pre>
    </div>
  );
}

function AddedTests({ version, parent }: { version: AgentVersion; parent: AgentVersion | undefined }) {
  const added = useMemo(() => {
    const before = new Set((parent?.spec.tests ?? []).map(testKey));
    return version.spec.tests.filter((t) => (parent ? !before.has(testKey(t)) : false) || t.addedBy === "repair");
  }, [version, parent]);
  if (added.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-[13px] font-medium text-stone-700">
        <Term id="regression-test">Checks added in this change</Term>
      </h4>
      {added.map((t, i) => {
        const repair = t.addedBy === "repair";
        return (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 rounded-[3px] border px-2 py-1.5 text-[12px]",
              repair ? "border-violet-300 bg-violet-50 text-violet-950" : "border-stone-300 bg-white text-stone-800",
            )}
          >
            <FlaskConical className={cn("mt-0.5 size-3.5 shrink-0", repair && "text-violet-600")} aria-hidden />
            <div className="min-w-0">
              <span className="font-mono">
                {t.kind}
                {t.config?.stepId ? `(${t.config.stepId})` : ""}
              </span>
              {repair && <span className="ml-2 text-[11px] font-medium text-violet-700">added by the fix</span>}
              {t.note && <p className="mt-0.5 text-[12px] leading-snug">{t.note}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VersionRow({
  version,
  parent,
  defaultOpen,
  isActive,
  agentId,
  onChanged,
}: {
  version: AgentVersion;
  parent: AgentVersion | undefined;
  defaultOpen: boolean;
  isActive: boolean;
  agentId: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const factory = version.createdBy === "factory";

  async function decide(kind: "accept" | "reject") {
    setBusy(kind);
    try {
      if (kind === "accept") await acceptVersion(agentId, version.version);
      else await rejectVersion(agentId, version.version);
      if (kind === "accept") track("version_accepted");
      toast.success(kind === "accept" ? `Testing v${version.version}…` : `v${version.version} rejected`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <StaggerItem
      as="li"
      className={cn(
        "border-l-2 pl-3",
        factory ? "border-l-violet-500" : "border-l-stone-300",
        isActive && "relative border border-l-2 border-emerald-300 bg-white py-3 pr-3",
      )}
    >
      {isActive && (
        <span className="absolute right-0 top-0 rounded-bl-[3px] bg-emerald-600 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white">
          in use
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[3px] bg-stone-900 px-1.5 py-0.5 font-mono text-[12px] tabular-nums text-[#F6F4EF]">
          v{version.version}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[12px] font-medium",
            factory ? "border-violet-300 bg-violet-50 text-violet-800" : "border-stone-300 bg-stone-100 text-stone-600",
          )}
        >
          {factory ? <Wrench className="size-3" aria-hidden /> : <User className="size-3" aria-hidden />}
          {factory ? (
            <Term id="repair" className="text-violet-800">
              Fixed automatically
            </Term>
          ) : (
            "Made by you"
          )}
        </span>
        <span
          className={cn(
            "rounded-[3px] border px-1.5 py-0.5 text-[12px]",
            STATUS_CLS[version.status],
          )}
        >
          {STATUS_LABEL[version.status]}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-stone-500" title={fullTime(version.createdAt)}>
          {relTime(version.createdAt)}
        </span>
      </div>

      {factory && parent ? (
        <div className="mt-2 max-w-2xl rounded-[3px] border border-violet-300 bg-violet-50 px-3 py-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-violet-800">
            <Wrench className="size-3.5" aria-hidden /> What it fixed, and why
          </h3>
          <p className="mt-1 text-[14px] leading-snug text-violet-950">{version.reason}</p>
        </div>
      ) : (
        <p className="mt-2 max-w-2xl text-[15px] font-medium leading-snug text-stone-900">{version.reason}</p>
      )}

      {version.status === "proposed" && (
        <FadeIn className="mt-2">
          <Pulse trigger={version.version} tone="violet">
          <div className="flex gap-2">
          <button className={BTN_PRIMARY} disabled={busy !== null} onClick={() => decide("accept")}>
            {busy === "accept" && <Loader2 className="size-3.5 animate-spin" />} Accept
          </button>
          <button className={BTN_SECONDARY} disabled={busy !== null} onClick={() => decide("reject")}>
            {busy === "reject" && <Loader2 className="size-3.5 animate-spin" />} Reject
          </button>
          </div>
          </Pulse>
        </FadeIn>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 rounded-[3px] text-[13px] font-medium text-stone-600 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
        {parent ? (
          <>
            <Term id="spec">What changed</Term>
            <span className="font-mono text-[11px] font-normal text-stone-400">vs v{parent.version}</span>
          </>
        ) : (
          <Term id="spec">The recipe</Term>
        )}
      </button>

      <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="diff"
          style={{ transformOrigin: "top" }}
          initial={{ opacity: 0, scaleY: 0.94 }}
          animate={{ opacity: 1, scaleY: 1, transition: SPRING.gentle }}
          exit={{ opacity: 0, transition: { duration: DURATION.fast, ease: EASE.in } }}
          className="mt-2 flex flex-col gap-3 pb-1"
        >
          {parent ? (
            <DiffView version={version} parent={parent} />
          ) : (
            <p className="text-[12px] text-stone-500">Initial version — no parent to diff against.</p>
          )}
          <AddedTests version={version} parent={parent} />
        </motion.div>
      )}
      </AnimatePresence>
    </StaggerItem>
  );
}

export function VersionHistory({
  agentId,
  versions,
  currentVersion,
  onChanged,
}: {
  agentId: string;
  versions: AgentVersion[];
  currentVersion: number | null;
  onChanged: () => void;
}) {
  const [showRejected, setShowRejected] = useState(false);
  const sorted = useMemo(() => [...versions].sort((a, b) => b.version - a.version), [versions]);
  const kept = sorted.filter((v) => v.status !== "rejected");
  const rejected = sorted.filter((v) => v.status === "rejected");
  const heroVersion = kept.find(
    (v) => v.createdBy === "factory" && v.parentVersion != null && (v.status === "active" || v.version === currentVersion),
  )?.version;

  const row = (v: AgentVersion) => (
    <VersionRow
      key={v.version}
      version={v}
      parent={versions.find((p) => p.version === v.parentVersion)}
      defaultOpen={v.version === heroVersion}
      isActive={v.version === currentVersion}
      agentId={agentId}
      onChanged={onChanged}
    />
  );

  return (
    <section className={cn(PANEL, "p-4")} aria-label="Changes over time">
      <h2 className="mb-3 text-[16px] font-semibold tracking-tight text-stone-900">
        Changes over time <span className="text-[13px] font-normal text-stone-500">(<Term id="version">versions</Term>)</span>
      </h2>
      {versions.length === 0 ? (
        <p className="text-[13px] text-stone-500">No versions yet.</p>
      ) : (
        <Stagger as="ol" gap="tight" className="flex flex-col gap-6">
          {kept.map(row)}
          {rejected.length > 0 && (
            <li className="opacity-70">
              <button
                onClick={() => setShowRejected((o) => !o)}
                aria-expanded={showRejected}
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-dashed border-stone-300 px-2 py-1 font-mono text-[11px] text-stone-500 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
              >
                <ChevronRight className={cn("size-3.5 transition-transform", showRejected && "rotate-90")} aria-hidden />
                {rejected.length} rejected attempt{rejected.length === 1 ? "" : "s"}
                <span className="text-stone-400">
                  ({rejected.map((v) => `v${v.version}`).join(", ")})
                </span>
              </button>
              {showRejected && <ol className="mt-4 flex flex-col gap-6">{rejected.map(row)}</ol>}
            </li>
          )}
        </Stagger>
      )}
    </section>
  );
}
