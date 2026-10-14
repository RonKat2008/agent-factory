"use client";

import { useState, type ComponentType, type FormEvent } from "react";
import { ExternalLink, Loader2, Lock, Send, Unplug } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Pulse } from "@/components/motion";
import { disconnect, saveConnection, testConnection, type ConnectionStatus, type Provider } from "./api";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, ConnPill, INPUT, LABEL, relTime } from "./parts";

export type Field = { name: string; label: string; placeholder: string; secret?: boolean; optional?: boolean; pattern?: RegExp; hint?: string };

export type ConnectableDef = {
  provider: Provider;
  title: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  uses: string[];
  fields: Field[];
  testLabel: string;
  howTo: { href: string; text: string };
  detail: (c: ConnectionStatus) => string;
};

type Props = {
  def: ConnectableDef;
  status: ConnectionStatus | null;
  isUnlocked: boolean;
  onChange: (c: ConnectionStatus) => void;
};

type Busy = null | "save" | "test" | "delete";

export function ConnectableCard({ def, status, isUnlocked, onChange }: Props) {
  const [busy, setBusy] = useState<Busy>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(0);

  const isConnected = !!status?.connected;
  const pill = !status ? "not_connected" : status.via === "env" ? "env" : isConnected ? "connected" : "not_connected";
  const showForm = isUnlocked && (!isConnected || isEditing);
  const tested = relTime(typeof status?.meta.lastTestAt === "string" ? status.meta.lastTestAt : null);
  const Icon = def.icon;

  async function run<T>(kind: Exclude<Busy, null>, fn: () => Promise<T>): Promise<T | null> {
    setBusy(kind);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error(`${def.title}: ${msg}`);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    for (const f of def.fields) {
      const v = (values[f.name] ?? "").trim();
      if (!v && !f.optional) return setError(`${f.label} is required`);
      if (v && f.pattern && !f.pattern.test(v)) return setError(f.hint ?? `${f.label} looks wrong`);
    }
    const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    const r = await run("save", () => saveConnection(def.provider, body));
    if (!r) return;
    onChange(r.connection);
    setValues({});
    setIsEditing(false);
    toast.success(`${def.title} connected`);
  }

  async function handleTest() {
    const r = await run("test", () => testConnection(def.provider));
    if (!r) return;
    onChange(r.connection);
    setTestOk((n) => n + 1);
    toast.success(def.provider === "slack" ? "Test message sent to Slack" : "GitHub access confirmed");
  }

  async function handleDisconnect() {
    const r = await run("delete", () => disconnect(def.provider));
    if (!r) return;
    onChange(r.connection);
    toast.success(`${def.title} disconnected`);
  }

  return (
    <article className="flex min-w-0 flex-col rounded-[3px] border border-stone-300 bg-[#FBFAF7] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <header className="flex items-start gap-3 border-b border-stone-200 p-4">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-[3px] border", isConnected ? "border-stone-900 bg-stone-900 text-[#F6F4EF]" : "border-stone-300 bg-white text-stone-700")}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold tracking-tight text-stone-900">{def.title}</h2>
            <Pulse trigger={testOk} tone="emerald">
              <ConnPill state={pill} />
            </Pulse>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-stone-600">{def.description}</p>
          {!isConnected ? <p className="mt-1 text-[12.5px] text-stone-500">Connect once, and any agent can use it.</p> : null}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className={LABEL}>Account</dt>
          <dd className={cn("min-w-0 truncate font-mono text-[12.5px]", isConnected ? "text-stone-900" : "text-stone-400")}>
            {status && isConnected ? def.detail(status) : "—"}
          </dd>
          <dt className={LABEL}>Agents use</dt>
          <dd className="flex flex-wrap gap-1">
            {def.uses.map((u) => (
              <code key={u} className="rounded-sm border border-stone-200 bg-white px-1 font-mono text-[11.5px] text-stone-700">{u}</code>
            ))}
          </dd>
          {tested ? (
            <>
              <dt className={LABEL}>Last test</dt>
              <dd className={cn("font-mono text-[12.5px]", status?.meta.lastTestOk === false ? "text-red-600" : "text-emerald-700")}>
                {status?.meta.lastTestOk === false ? "failed" : "ok"} · {tested}
              </dd>
            </>
          ) : null}
        </dl>

        {showForm ? (
          <form onSubmit={handleSave} className="flex flex-col gap-2.5 rounded-[3px] border border-dashed border-stone-300 bg-white/60 p-3">
            {def.fields.map((f) => (
              <label key={f.name} className="flex flex-col gap-1">
                <span className={LABEL}>{f.label}{f.optional ? " · optional" : ""}</span>
                <input
                  className={INPUT}
                  name={f.name}
                  type={f.secret ? "password" : "text"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={f.placeholder}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                />
              </label>
            ))}
            <a href={def.howTo.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-start text-[12px] text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline">
              {def.howTo.text} <ExternalLink className="size-3" aria-hidden />
            </a>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" className={BTN_PRIMARY} disabled={busy !== null}>
                {busy === "save" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {busy === "save" ? (def.provider === "github" ? "Checking…" : "Saving…") : "Save connection"}
              </button>
              {isEditing ? (
                <button type="button" className={BTN_SECONDARY} onClick={() => { setIsEditing(false); setError(null); }}>Cancel</button>
              ) : null}
            </div>
          </form>
        ) : null}

        {error ? <p role="alert" className="text-[12.5px] text-red-600">{error}</p> : null}

        <footer className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {!isUnlocked ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-stone-500"><Lock className="size-3.5" aria-hidden /> Read-only · unlock to manage</span>
          ) : isConnected && !isEditing ? (
            <>
              <button type="button" className={BTN_PRIMARY} onClick={handleTest} disabled={busy !== null}>
                {busy === "test" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
                {def.testLabel}
              </button>
              <button type="button" className={BTN_SECONDARY} onClick={() => setIsEditing(true)} disabled={busy !== null}>Replace</button>
              {status?.via === "connection" ? (
                <button type="button" className={BTN_DANGER} onClick={handleDisconnect} disabled={busy !== null}>
                  {busy === "delete" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Unplug className="size-3.5" aria-hidden />}
                  Disconnect
                </button>
              ) : null}
            </>
          ) : null}
        </footer>
      </div>
    </article>
  );
}
