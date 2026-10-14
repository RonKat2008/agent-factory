"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createConnector, previewConnector,
  type CommunityConnector, type ConnectorAction, type ConnectorDraft, type ConnectorParam, type TestResponse,
} from "./connectors-api";
import { ResultPreview } from "./result-preview";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from "./parts";

type Tab = "http" | "mcp";
type ActionDraft = { key: number; name: string; description: string; method: "GET" | "POST"; path: string; params: (ConnectorParam & { key: number })[] };

const SNAKE = /^[a-z][a-z0-9_]{0,39}$/;
const PARAM = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const MAX_ACTIONS = 8;
const MCP_EXAMPLE = "https://mcp.deepwiki.com/mcp";
let nextKey = 1;

const newParam = (): ActionDraft["params"][number] => ({ key: nextKey++, name: "", description: "", in: "query", required: true });
const newAction = (): ActionDraft => ({ key: nextKey++, name: "", description: "", method: "GET", path: "", params: [] });

function isHttpsUrl(v: string): boolean {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

function validateHttp(name: string, baseUrl: string, authHeader: string, secret: string, actions: ActionDraft[]): string | null {
  if (name.trim().length < 2) return "Give the connector a name";
  if (!isHttpsUrl(baseUrl.trim())) return "Base URL must start with https://";
  if (secret && !authHeader.trim()) return "Add the header name the secret goes in (e.g. Authorization)";
  for (const a of actions) {
    if (!SNAKE.test(a.name)) return `Action names are snake_case (got "${a.name || "empty"}")`;
    if (a.description.trim().length < 3) return `Describe what ${a.name} does: the builder reads this`;
    for (const p of a.params) if (!PARAM.test(p.name)) return `${a.name}: param names are letters, digits and _`;
  }
  return null;
}

function toDraft(tab: Tab, f: { name: string; baseUrl: string; authHeader: string; secret: string; actions: ActionDraft[] }): ConnectorDraft {
  if (tab === "mcp") return { kind: "mcp", name: f.name.trim(), baseUrl: f.baseUrl.trim(), secret: f.secret };
  return {
    kind: "http",
    name: f.name.trim(),
    baseUrl: f.baseUrl.trim(),
    authHeader: f.authHeader.trim(),
    secret: f.secret,
    actions: f.actions.map((a) => ({
      name: a.name.trim(),
      description: a.description.trim(),
      method: a.method,
      path: a.path.trim(),
      params: a.params.map((p) => ({ name: p.name.trim(), description: p.description.trim(), in: p.in, required: p.required })),
    })),
  };
}

type Props = { onClose: () => void; onCreated: (c: CommunityConnector) => void };

export function AddConnectorPanel({ onClose, onCreated }: Props) {
  const [tab, setTab] = useState<Tab>("http");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [secret, setSecret] = useState("");
  const [actions, setActions] = useState<ActionDraft[]>(() => [{ key: 0, name: "", description: "", method: "GET", path: "", params: [] }]);
  const [testAction, setTestAction] = useState("");
  const [testArgs, setTestArgs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "test" | "save">(null);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestResponse | null>(null);

  const fields = { name, baseUrl, authHeader, secret, actions };
  const selectedAction = actions.find((a) => a.name === testAction) ?? actions[0];
  const mcpTools: ConnectorAction[] = tab === "mcp" && test?.actions ? test.actions : [];
  const passed = !!test?.ok;

  function resetTest() {
    setTest(null);
    setError(null);
  }

  function updateAction(key: number, patch: Partial<ActionDraft>) {
    setActions((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
    resetTest();
  }

  function updateParam(aKey: number, pKey: number, patch: Partial<ConnectorParam>) {
    setActions((prev) => prev.map((a) => (a.key === aKey ? { ...a, params: a.params.map((p) => (p.key === pKey ? { ...p, ...patch } : p)) } : a)));
    resetTest();
  }

  function localError(): string | null {
    if (tab === "mcp") {
      if (name.trim().length < 2) return "Give the connector a name";
      return isHttpsUrl(baseUrl.trim()) ? null : "MCP server URL must start with https://";
    }
    return validateHttp(name, baseUrl, authHeader, secret, actions);
  }

  async function handleTest() {
    const problem = localError();
    if (problem) return setError(problem);
    setBusy("test");
    setError(null);
    try {
      const actionName = tab === "http" ? selectedAction?.name : undefined;
      const r = await previewConnector(toDraft(tab, fields), actionName, tab === "http" ? testArgs : {});
      setTest(r);
      if (!r.ok) setError(r.error);
    } catch (e) {
      setError((e as Error).message);
      setTest(null);
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const problem = localError();
    if (problem) return setError(problem);
    setBusy("save");
    setError(null);
    try {
      const { connector } = await createConnector(toDraft(tab, fields));
      toast.success(`${connector.name} added · agents can use "${connector.slug}" now`);
      onCreated(connector);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="add-connector-heading" className="rounded-[3px] border border-stone-400 bg-[#FBFAF7] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <header className="flex items-center justify-between gap-3 border-b border-stone-300 px-4 py-3">
        <div className="min-w-0">
          <h2 id="add-connector-heading" className="text-[15px] font-semibold text-stone-900">Add a connector</h2>
          <p className="text-[12.5px] text-stone-600">Anyone can add one. Pitcrew&apos;s builder sees it immediately and agents can call it on their next build.</p>
        </div>
        <button type="button" onClick={onClose} className={cn(BTN_SECONDARY, "w-8 px-0")} aria-label="Close">
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div role="tablist" aria-label="Connector kind" className="flex gap-0 border-b border-stone-300 px-4">
        {(["http", "mcp"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              resetTest();
            }}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40",
              tab === t ? "border-stone-900 font-semibold text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800",
            )}
          >
            {t === "http" ? "HTTP API" : "MCP server"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4 p-4" noValidate>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Name" htmlFor="cx-name">
            <input id="cx-name" className={INPUT} placeholder={tab === "http" ? "Open-Meteo weather" : "DeepWiki"} value={name} onChange={(e) => { setName(e.target.value); resetTest(); }} maxLength={60} />
          </Field>
          <Field label={tab === "http" ? "Base URL (https)" : "MCP server URL (Streamable HTTP)"} htmlFor="cx-url">
            <input
              id="cx-url"
              className={INPUT}
              inputMode="url"
              placeholder={tab === "http" ? "https://api.open-meteo.com" : MCP_EXAMPLE}
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); resetTest(); }}
              aria-invalid={!!baseUrl && !isHttpsUrl(baseUrl.trim())}
            />
          </Field>
          {tab === "http" ? (
            <>
              <Field label="Auth header (optional)" htmlFor="cx-header">
                <input id="cx-header" className={INPUT} placeholder="Authorization or X-Api-Key" value={authHeader} onChange={(e) => { setAuthHeader(e.target.value); resetTest(); }} maxLength={64} />
              </Field>
              <Field label="Secret value (optional, encrypted)" htmlFor="cx-secret">
                <input id="cx-secret" type="password" autoComplete="off" className={INPUT} placeholder="Bearer sk-…" value={secret} onChange={(e) => { setSecret(e.target.value); resetTest(); }} />
              </Field>
            </>
          ) : (
            <Field label="Bearer token (optional, encrypted)" htmlFor="cx-token">
              <input id="cx-token" type="password" autoComplete="off" className={INPUT} placeholder="token sent as Authorization: Bearer …" value={secret} onChange={(e) => { setSecret(e.target.value); resetTest(); }} />
            </Field>
          )}
        </div>

        {tab === "http" ? (
          <HttpActions
            actions={actions}
            onAdd={() => { setActions((p) => [...p, newAction()]); resetTest(); }}
            onRemove={(key) => { setActions((p) => p.filter((a) => a.key !== key)); resetTest(); }}
            onUpdate={updateAction}
            onAddParam={(key) => updateAction(key, { params: [...(actions.find((a) => a.key === key)?.params ?? []), newParam()] })}
            onRemoveParam={(aKey, pKey) => updateAction(aKey, { params: (actions.find((a) => a.key === aKey)?.params ?? []).filter((p) => p.key !== pKey) })}
            onUpdateParam={updateParam}
          />
        ) : (
          <p className="text-[12.5px] text-stone-600">
            Test connects with the MCP protocol and lists the server&apos;s tools. Each tool becomes an action agents can call. Try <button type="button" className="font-mono text-stone-900 underline decoration-stone-400 underline-offset-2 hover:decoration-stone-900" onClick={() => { setBaseUrl(MCP_EXAMPLE); if (!name) setName("DeepWiki"); resetTest(); }}>{MCP_EXAMPLE}</button> (public, no token).
          </p>
        )}

        {tab === "http" && selectedAction ? (
          <fieldset className="flex flex-col gap-2 rounded-[3px] border border-dashed border-stone-300 p-3">
            <legend className={cn(LABEL, "px-1")}>Test call</legend>
            <div className="flex flex-wrap items-end gap-2">
              {actions.length > 1 ? (
                <label className="flex flex-col gap-1">
                  <span className={LABEL}>Action</span>
                  <select className={cn(INPUT, "w-44")} value={selectedAction.name} onChange={(e) => { setTestAction(e.target.value); resetTest(); }}>
                    {actions.map((a) => <option key={a.key} value={a.name}>{a.name || "(unnamed)"}</option>)}
                  </select>
                </label>
              ) : null}
              {selectedAction.params.map((p) => (
                <label key={p.key} className="flex flex-col gap-1">
                  <span className={LABEL}>{p.name || "param"}{p.required ? " *" : ""}</span>
                  <input className={cn(INPUT, "w-40")} value={testArgs[p.name] ?? ""} onChange={(e) => setTestArgs((prev) => ({ ...prev, [p.name]: e.target.value }))} placeholder={p.description || p.in} />
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {error ? <p role="alert" className="rounded-[3px] border border-red-200 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-700">{error}</p> : null}
        {test?.ok && test.result ? <ResultPreview result={test.result} /> : null}
        {mcpTools.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[12.5px] text-emerald-700">Connected · {test && "total" in test && test.total ? test.total : mcpTools.length} tools found{test && "total" in test && test.total && test.total > mcpTools.length ? ` (first ${mcpTools.length} saved)` : ""}</p>
            <ul className="flex flex-col gap-1">
              {mcpTools.map((t) => (
                <li key={t.name} className="text-[12.5px] text-stone-700">
                  <span className="font-mono text-stone-900">{t.name}</span>
                  <span className="text-stone-500">({t.params.map((p) => p.name).join(", ")})</span> {t.description}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-3">
          {!passed ? <span className="mr-auto text-[12px] text-stone-500">Test before saving.</span> : <span className="mr-auto text-[12px] text-emerald-700">Test passed.</span>}
          <button type="button" className={BTN_SECONDARY} onClick={handleTest} disabled={busy !== null}>
            {busy === "test" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            {tab === "mcp" ? "Connect & list tools" : "Test"}
          </button>
          <button type="submit" className={BTN_PRIMARY} disabled={busy !== null || !passed}>
            {busy === "save" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Save connector
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

type HttpActionsProps = {
  actions: ActionDraft[];
  onAdd: () => void;
  onRemove: (key: number) => void;
  onUpdate: (key: number, patch: Partial<ActionDraft>) => void;
  onAddParam: (key: number) => void;
  onRemoveParam: (aKey: number, pKey: number) => void;
  onUpdateParam: (aKey: number, pKey: number, patch: Partial<ConnectorParam>) => void;
};

function HttpActions({ actions, onAdd, onRemove, onUpdate, onAddParam, onRemoveParam, onUpdateParam }: HttpActionsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={LABEL}>Actions · {actions.length}/{MAX_ACTIONS}</span>
        <button type="button" className={BTN_SECONDARY} onClick={onAdd} disabled={actions.length >= MAX_ACTIONS}>
          <Plus className="size-3.5" aria-hidden /> Action
        </button>
      </div>
      {actions.map((a) => {
        const badName = !!a.name && !SNAKE.test(a.name);
        return (
          <div key={a.key} className="flex flex-col gap-2 rounded-[3px] border border-stone-300 bg-white p-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,10rem)_5.5rem_minmax(0,1fr)_auto]">
              <input aria-label="Action name" aria-invalid={badName} className={cn(INPUT, badName && "border-red-400")} placeholder="get_forecast" value={a.name} onChange={(e) => onUpdate(a.key, { name: e.target.value })} />
              <select aria-label="Method" className={INPUT} value={a.method} onChange={(e) => onUpdate(a.key, { method: e.target.value as "GET" | "POST", params: e.target.value === "GET" ? a.params.map((p) => (p.in === "body" ? { ...p, in: "query" } : p)) : a.params })}>
                <option>GET</option>
                <option>POST</option>
              </select>
              <input aria-label="Path" className={INPUT} placeholder="/v1/forecast?current=temperature_2m  ·  /users/{id}" value={a.path} onChange={(e) => onUpdate(a.key, { path: e.target.value })} />
              <button type="button" className={cn(BTN_SECONDARY, "w-8 px-0")} aria-label={`Remove action ${a.name}`} onClick={() => onRemove(a.key)} disabled={actions.length === 1}>
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
            {badName ? <p className="text-[11.5px] text-red-600">snake_case: lowercase letters, digits, _</p> : null}
            <input aria-label="Action description" className={cn(INPUT, "font-sans")} placeholder="What it returns, in plain English. The builder reads this to decide when to use it." value={a.description} onChange={(e) => onUpdate(a.key, { description: e.target.value })} maxLength={300} />
            {a.params.map((p) => (
              <div key={p.key} className="grid grid-cols-1 gap-2 pl-3 sm:grid-cols-[minmax(0,8rem)_5.5rem_minmax(0,1fr)_auto_auto] sm:items-center">
                <input aria-label="Param name" className={INPUT} placeholder="latitude" value={p.name} onChange={(e) => onUpdateParam(a.key, p.key, { name: e.target.value })} />
                <select aria-label="Param location" className={INPUT} value={p.in} onChange={(e) => onUpdateParam(a.key, p.key, { in: e.target.value as ConnectorParam["in"] })}>
                  <option value="query">query</option>
                  <option value="path">path</option>
                  {a.method === "POST" ? <option value="body">body</option> : null}
                </select>
                <input aria-label="Param description" className={cn(INPUT, "font-sans")} placeholder="e.g. decimal latitude like 37.77" value={p.description} onChange={(e) => onUpdateParam(a.key, p.key, { description: e.target.value })} />
                <label className="flex items-center gap-1.5 text-[12px] text-stone-600">
                  <input type="checkbox" checked={p.required} onChange={(e) => onUpdateParam(a.key, p.key, { required: e.target.checked })} /> required
                </label>
                <button type="button" className={cn(BTN_SECONDARY, "w-8 px-0")} aria-label={`Remove param ${p.name}`} onClick={() => onRemoveParam(a.key, p.key)}>
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
            <button type="button" className="self-start pl-3 text-[12px] text-stone-600 underline decoration-stone-300 underline-offset-2 hover:text-stone-900" onClick={() => onAddParam(a.key)}>
              + param
            </button>
          </div>
        );
      })}
    </div>
  );
}
