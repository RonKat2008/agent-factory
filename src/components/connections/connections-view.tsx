"use client";

import { useEffect, useState, type ComponentType, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, GitBranch, Hash, KeyRound, Loader2, LockOpen, Network, Newspaper, PackageOpen, Rss, SquareTerminal } from "lucide-react";
import { toast } from "sonner";
import { getConnections, getUnlocked, lock, unlock, type ConnectionStatus, type Provider } from "./api";
import { CommunityConnectors } from "./community-connectors";
import { ConnectableCard, type ConnectableDef } from "./connectable-card";
import { BTN_PRIMARY, BTN_SECONDARY, ConnPill, INPUT, LABEL } from "./parts";

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

const CONNECTABLE: ConnectableDef[] = [
  {
    provider: "slack",
    title: "Slack",
    icon: Hash,
    description: "Agents post their results, approval requests and factory repair notices to a Slack channel.",
    uses: ["send_slack", "repair notices"],
    fields: [
      { name: "webhookUrl", label: "Incoming webhook URL", placeholder: "https://hooks.slack.com/services/T…/B…/…", secret: true, pattern: /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/-]+$/, hint: "Webhook URL must start with https://hooks.slack.com/services/" },
      { name: "channel", label: "Channel label", placeholder: "#factory-demo", optional: true },
    ],
    testLabel: "Send test message",
    howTo: { href: "https://api.slack.com/apps", text: "api.slack.com/apps → your app → Incoming Webhooks → Add New Webhook" },
    detail: (c) => (c.via === "env" ? "SLACK_WEBHOOK_URL (environment)" : `${str(c.meta.channel) ?? "Incoming webhook"} · webhook`),
  },
  {
    provider: "github",
    title: "GitHub",
    icon: GitBranch,
    description: "Agents read open issues and apply labels and triage comments on your repo.",
    uses: ["github_issues"],
    fields: [
      { name: "token", label: "Fine-grained token", placeholder: "github_pat_…", secret: true },
      { name: "repo", label: "Default repo (owner/name)", placeholder: "acme/website", pattern: /^[\w.-]+\/[\w.-]+$/, hint: 'Default repo must be "owner/name"' },
    ],
    testLabel: "Test access",
    howTo: { href: "https://github.com/settings/personal-access-tokens/new", text: "github.com → Settings → Fine-grained token (Issues: read & write)" },
    detail: (c) => {
      if (c.via === "env") return "GITHUB_TOKEN (environment)";
      const login = str(c.meta.login);
      const repo = str(c.meta.repo);
      const access = c.meta.canPush ? "write access" : "read access";
      return [login ? `@${login}` : null, repo, access].filter(Boolean).join(" · ");
    },
  },
];

type Builtin = { title: string; icon: ComponentType<{ className?: string }>; description: string; detail: string };

const BUILTINS: Builtin[] = [
  { title: "Hacker News", icon: Newspaper, description: "Search stories and comments by keyword and time window.", detail: "hn_search · Algolia API" },
  { title: "Web & RSS", icon: Rss, description: "Fetch pages and feeds, then diff against what the agent saw last time.", detail: "fetch_url · fetch_rss · diff_with_memory" },
  { title: "Vercel Sandbox", icon: SquareTerminal, description: "Run generated code in an isolated microVM.", detail: "run_code · Firecracker" },
  { title: "Vercel AI Gateway", icon: Network, description: "Models for summarizing, judging and self-repair.", detail: "llm · OIDC auth" },
  { title: "eve", icon: PackageOpen, description: "Export any agent as a standalone eve project.", detail: "export · .zip" },
];

export function ConnectionsView() {
  const [connections, setConnections] = useState<Partial<Record<Provider, ConnectionStatus>>>({});
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getConnections(), getUnlocked().catch(() => false)])
      .then(([list, unlocked]) => {
        if (!alive) return;
        setConnections(Object.fromEntries(list.map((c) => [c.provider, c])));
        setIsUnlocked(unlocked);
      })
      .catch((e: Error) => alive && setLoadError(e.message))
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const connectedCount = Object.values(connections).filter((c) => c?.connected).length;
  const update = (c: ConnectionStatus) => setConnections((prev) => ({ ...prev, [c.provider]: c }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-stone-300 pb-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className={LABEL}>Factory · credentials</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-stone-900">Connections</h1>
          <p className="mt-1 max-w-[60ch] text-[14px] text-stone-600">
            What your agents can reach. Credentials are encrypted at rest and used only by agents at run time; they never come back to the browser.
          </p>
          <Link href="/connections/build" className="mt-2 inline-flex items-center gap-1 text-[13px] text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-stone-900 hover:decoration-stone-900">
            Build a connector: HTTP, MCP or a first-class block <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <div className="flex flex-wrap items-end gap-4 sm:gap-6">
          <div className="text-right">
            <div className="font-mono text-[32px] leading-none tabular-nums text-stone-900">
              {isLoading ? "–" : connectedCount + BUILTINS.length}
              <span className="text-stone-400">/{CONNECTABLE.length + BUILTINS.length}</span>
            </div>
            <div className={`${LABEL} mt-1`}>available</div>
          </div>
          <UnlockControl isUnlocked={isUnlocked} onChange={setIsUnlocked} />
        </div>
      </header>

      {loadError ? <p role="alert" className="text-[13px] text-red-600">Couldn&apos;t load connections: {loadError}</p> : null}

      <section aria-labelledby="connectable-heading" className="flex flex-col gap-3">
        <h2 id="connectable-heading" className={LABEL}>Accounts · connect once, every agent can use them</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {CONNECTABLE.map((def) =>
            isLoading ? (
              <div key={def.provider} className="h-[248px] animate-pulse rounded-[3px] border border-stone-300 bg-[#FBFAF7]" />
            ) : (
              <ConnectableCard key={def.provider} def={def} status={connections[def.provider] ?? null} isUnlocked={isUnlocked} onChange={update} />
            ),
          )}
        </div>
      </section>

      <CommunityConnectors />

      <section aria-labelledby="builtin-heading" className="flex flex-col gap-3">
        <h2 id="builtin-heading" className={LABEL}>Built in · no setup</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {BUILTINS.map((b) => (
            <BuiltinCard key={b.title} item={b} />
          ))}
        </div>
      </section>
    </div>
  );
}

function BuiltinCard({ item }: { item: Builtin }) {
  const Icon = item.icon;
  return (
    <article className="flex min-w-0 items-start gap-3 rounded-[3px] border border-stone-300 bg-[#FBFAF7] p-3 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <span className="grid size-8 shrink-0 place-items-center rounded-[3px] border border-stone-300 bg-white text-stone-700">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-[14px] font-semibold text-stone-900">{item.title}</h3>
          <ConnPill state="ready" />
        </div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-stone-600">{item.description}</p>
        <p className="mt-1.5 truncate font-mono text-[11.5px] text-stone-500">{item.detail}</p>
      </div>
    </article>
  );
}

function UnlockControl({ isUnlocked, onChange }: { isUnlocked: boolean; onChange: (v: boolean) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [key, setKey] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setIsBusy(true);
    try {
      await unlock(key.trim());
      onChange(true);
      setIsOpen(false);
      setKey("");
      toast.success("Unlocked for this browser");
    } catch (err) {
      toast.error((err as Error).message === "wrong key" ? "Wrong admin key" : (err as Error).message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLock() {
    await lock().catch(() => null);
    onChange(false);
  }

  if (isUnlocked) {
    return (
      <button type="button" className={BTN_SECONDARY} onClick={handleLock}>
        <LockOpen className="size-3.5 text-emerald-600" aria-hidden /> Managing · lock
      </button>
    );
  }
  if (!isOpen) {
    return (
      <button type="button" className={BTN_SECONDARY} onClick={() => setIsOpen(true)}>
        <KeyRound className="size-3.5" aria-hidden /> Unlock to manage connections
      </button>
    );
  }
  return (
    <form onSubmit={handleUnlock} className="flex items-center gap-2">
      <label className="sr-only" htmlFor="admin-key">Admin key</label>
      <input id="admin-key" autoFocus type="password" autoComplete="current-password" placeholder="Admin key" className={`${INPUT} w-40`} value={key} onChange={(e) => setKey(e.target.value)} />
      <button type="submit" className={BTN_PRIMARY} disabled={isBusy || !key.trim()}>
        {isBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        Unlock
      </button>
    </form>
  );
}
