"use client";
import { useMemo, useState } from "react";
import { ChevronRight, FlaskConical, Loader2, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { track } from "@vercel/analytics";
import { acceptVersion, rejectVersion } from "@/lib/api-client";
import type { AgentTest, AgentVersion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { collapseDiff, diffLines, diffStats } from "./diff";
import { BTN_PRIMARY, BTN_SECONDARY, LABEL, PANEL, fullTime, relTime } from "./format";

const STATUS_CLS: Record<AgentVersion["status"], string> = {
  active: "border-emerald-300 bg-emerald-50 text-emerald-800",
  proposed: "border-amber-300 bg-amber-50 text-amber-900",
  rejected: "border-stone-300 bg-stone-100 text-stone-500 line-through",
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
      <h4 className={LABEL}>Tests added in this version</h4>
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
              {repair && <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-violet-700">repair</span>}
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
  agentId,
  onChanged,
}: {
  version: AgentVersion;
  parent: AgentVersion | undefined;
  defaultOpen: boolean;
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
    <li className={cn("border-l-2 pl-3", factory ? "border-violet-500" : "border-stone-300")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[3px] bg-stone-900 px-1.5 py-0.5 font-mono text-[12px] tabular-nums text-[#F6F4EF]">
          v{version.version}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide",
            factory ? "border-violet-300 bg-violet-50 text-violet-800" : "border-stone-300 bg-stone-100 text-stone-600",
          )}
        >
          {factory ? <Wrench className="size-3" aria-hidden /> : <User className="size-3" aria-hidden />}
          {version.createdBy}
        </span>
        <span
          className={cn(
            "rounded-[3px] border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide",
            STATUS_CLS[version.status],
          )}
        >
          {version.status}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-stone-500" title={fullTime(version.createdAt)}>
          {relTime(version.createdAt)}
        </span>
      </div>

      <p className="mt-2 max-w-2xl text-[15px] font-medium leading-snug text-stone-900">{version.reason}</p>

      {version.status === "proposed" && (
        <div className="mt-2 flex gap-2">
          <button className={BTN_PRIMARY} disabled={busy !== null} onClick={() => decide("accept")}>
            {busy === "accept" && <Loader2 className="size-3.5 animate-spin" />} Accept
          </button>
          <button className={BTN_SECONDARY} disabled={busy !== null} onClick={() => decide("reject")}>
            {busy === "reject" && <Loader2 className="size-3.5 animate-spin" />} Reject
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 rounded-[3px] font-mono text-[11px] uppercase tracking-[0.1em] text-stone-600 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
        {parent ? `Diff vs v${parent.version}` : "Spec"}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-3 pb-1">
          {parent ? (
            <DiffView version={version} parent={parent} />
          ) : (
            <p className="text-[12px] text-stone-500">Initial version — no parent to diff against.</p>
          )}
          <AddedTests version={version} parent={parent} />
        </div>
      )}
    </li>
  );
}

export function VersionHistory({
  agentId,
  versions,
  onChanged,
}: {
  agentId: string;
  versions: AgentVersion[];
  onChanged: () => void;
}) {
  const heroVersion = versions.find((v) => v.createdBy === "factory" && v.parentVersion != null)?.version;
  return (
    <section className={cn(PANEL, "p-4")} aria-label="Version history">
      <h2 className={cn(LABEL, "mb-3")}>Version history</h2>
      {versions.length === 0 ? (
        <p className="text-[13px] text-stone-500">No versions yet.</p>
      ) : (
        <ol className="flex flex-col gap-6">
          {versions.map((v) => (
            <VersionRow
              key={v.version}
              version={v}
              parent={versions.find((p) => p.version === v.parentVersion)}
              defaultOpen={v.version === heroVersion}
              agentId={agentId}
              onChanged={onChanged}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
