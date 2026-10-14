"use client";

import { useEffect, useState } from "react";
import { Blocks, Globe, Loader2, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteConnector, listConnectors, testSavedConnector, type CommunityConnector, type TestResponse } from "./connectors-api";
import { AddConnectorPanel } from "./add-connector-panel";
import { ResultPreview } from "./result-preview";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, relTime } from "./parts";

const MAX_CHIPS = 6;

export function CommunityConnectors() {
  const [items, setItems] = useState<CommunityConnector[]>([]);
  const [max, setMax] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    listConnectors()
      .then((r) => {
        if (!alive) return;
        setItems(r.connectors);
        setMax(r.max);
      })
      .catch((e: Error) => alive && setLoadError(e.message))
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section aria-labelledby="community-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="community-heading" className={LABEL}>Community connectors · added by anyone, usable by every agent</h2>
          <p className="mt-0.5 font-mono text-[11.5px] tabular-nums text-stone-500">{isLoading ? "–" : items.length}/{max} slots</p>
        </div>
        {!isAdding ? (
          <button type="button" className={BTN_PRIMARY} onClick={() => setIsAdding(true)} disabled={!isLoading && items.length >= max}>
            <Plus className="size-3.5" aria-hidden /> Add a connector
          </button>
        ) : null}
      </div>

      {isAdding ? (
        <AddConnectorPanel
          onClose={() => setIsAdding(false)}
          onCreated={(c) => {
            setItems((prev) => [c, ...prev]);
            setIsAdding(false);
          }}
        />
      ) : null}

      {loadError ? <p role="alert" className="text-[13px] text-red-600">Couldn&apos;t load community connectors: {loadError}</p> : null}

      {isLoading ? (
        <div className="h-[132px] animate-pulse rounded-[3px] border border-stone-300 bg-[#FBFAF7]" />
      ) : items.length === 0 && !loadError ? (
        <div className="rounded-[3px] border border-dashed border-stone-300 px-4 py-6 text-center text-[13px] text-stone-600">
          No community connectors yet. Add an HTTP API or an MCP server and the builder can use it right away.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((c) => (
            <ConnectorCard key={c.id} connector={c} onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== c.id))} />
          ))}
        </div>
      )}
    </section>
  );
}

function ConnectorCard({ connector: c, onDeleted }: { connector: CommunityConnector; onDeleted: () => void }) {
  const [isTesting, setIsTesting] = useState(false);
  const [busy, setBusy] = useState<null | "test" | "delete">(null);
  const [action, setAction] = useState(c.actions[0]?.name ?? "");
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TestResponse | null>(null);
  const selected = c.actions.find((a) => a.name === action) ?? c.actions[0];
  const Icon = c.kind === "mcp" ? Blocks : Globe;
  const host = (() => {
    try {
      return new URL(c.baseUrl).host;
    } catch {
      return c.baseUrl;
    }
  })();

  async function handleRun() {
    if (!selected) return;
    setBusy("test");
    setResult(null);
    try {
      setResult(await testSavedConnector(c.slug, selected.name, args));
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the "${c.name}" connector? Agents that use it will fail until repaired.`)) return;
    setBusy("delete");
    try {
      await deleteConnector(c.slug);
      toast.success(`${c.name} deleted`);
      onDeleted();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-[3px] border border-stone-300 bg-[#FBFAF7] p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[3px] border border-stone-300 bg-white text-stone-700">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[14px] font-semibold text-stone-900">{c.name}</h3>
            <span className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wide", c.kind === "mcp" ? "border-violet-200 bg-violet-50 text-violet-800" : "border-stone-300 bg-white text-stone-700")}>
              {c.kind === "mcp" ? "MCP" : "HTTP"}
            </span>
            {c.hasSecret ? <span className="font-mono text-[10.5px] uppercase tracking-wide text-stone-500">auth · encrypted</span> : null}
          </div>
          <p className="mt-0.5 truncate font-mono text-[11.5px] text-stone-500" title={c.baseUrl}>
            {c.slug} · {host} · <span title={new Date(c.createdAt).toLocaleString()}>added {relTime(c.createdAt)}</span>
          </p>
        </div>
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-label={c.kind === "mcp" ? "Tools" : "Actions"}>
        {c.actions.slice(0, MAX_CHIPS).map((a) => (
          <li key={a.name} title={a.description} className="rounded-sm border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[11px] text-stone-700">
            {a.method && c.kind === "http" ? <span className="text-stone-400">{a.method} </span> : null}
            {a.name}
          </li>
        ))}
        {c.actions.length > MAX_CHIPS ? <li className="px-1 font-mono text-[11px] text-stone-500">+{c.actions.length - MAX_CHIPS}</li> : null}
      </ul>

      {isTesting && selected ? (
        <div className="flex flex-col gap-2 border-t border-stone-200 pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{c.kind === "mcp" ? "Tool" : "Action"}</span>
              <select className={cn(INPUT, "w-44")} value={selected.name} onChange={(e) => { setAction(e.target.value); setArgs({}); setResult(null); }}>
                {c.actions.map((a) => <option key={a.name}>{a.name}</option>)}
              </select>
            </label>
            {selected.params.map((p) => (
              <label key={p.name} className="flex flex-col gap-1">
                <span className={LABEL}>{p.name}{p.required ? " *" : ""}</span>
                <input className={cn(INPUT, "w-40")} value={args[p.name] ?? ""} onChange={(e) => setArgs((prev) => ({ ...prev, [p.name]: e.target.value }))} placeholder={p.description.slice(0, 40) || p.in} />
              </label>
            ))}
            <button type="button" className={BTN_PRIMARY} onClick={handleRun} disabled={busy !== null}>
              {busy === "test" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />} Run
            </button>
          </div>
          {selected.description ? <p className="text-[12px] text-stone-600">{selected.description}</p> : null}
          {result && !result.ok ? <p role="alert" className="rounded-[3px] border border-red-200 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-700">{result.error}</p> : null}
          {result?.ok && result.result ? <ResultPreview result={result.result} /> : null}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-end gap-2">
        <button type="button" className={BTN_SECONDARY} onClick={() => { setIsTesting((v) => !v); setResult(null); }}>
          {isTesting ? <X className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />} {isTesting ? "Close test" : "Test"}
        </button>
        {c.canDelete ? (
          <button type="button" className={BTN_DANGER} onClick={handleDelete} disabled={busy !== null}>
            {busy === "delete" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />} Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
