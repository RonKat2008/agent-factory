"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { disconnectSlack, slackStartUrl } from "./api";
import { SignInWithSlack } from "./sign-in-with-slack";
import { useMe } from "./use-me";

type Props = {
  agentId?: string | null;
  returnTo?: string;
  className?: string;
};

const LINK = "rounded-[2px] font-medium text-violet-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/50";

/**
 * The visitor's own Slack: "Sign in with Slack" when not connected; "✓ Posting to #channel · Team" with
 * Change / Disconnect when connected; a disabled "not configured yet" state when the site lacks the app keys.
 */
export function ConnectSlackButton({ agentId, returnTo, className }: Props) {
  const { me, isLoading } = useMe();
  const [isBusy, setIsBusy] = useState(false);

  if (isLoading) return <span className={cn("inline-block h-9 w-48 animate-pulse rounded-[4px] bg-stone-200", className)} aria-hidden />;
  const isConfigured = me?.slackOAuth.configured ?? false;
  const slack = me?.slack ?? null;

  if (!slack) {
    return (
      <div className={cn("flex flex-col items-start gap-1", className)}>
        <SignInWithSlack agentId={agentId} returnTo={returnTo} isConfigured={isConfigured} />
        {!isConfigured && <p className="text-[12px] text-stone-500">Paste a webhook instead for now.</p>}
      </div>
    );
  }

  async function handleDisconnect() {
    setIsBusy(true);
    try {
      await disconnectSlack();
      toast.success("Disconnected. Agents fall back to the team channel.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't disconnect");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]", className)}>
      <span className="inline-flex items-center gap-1.5 text-stone-900">
        <Check className="size-4 text-emerald-600" aria-hidden />
        Posting to <span className="font-mono">#{slack.channel}</span>
        <span className="text-stone-500">· {slack.team}</span>
      </span>
      {isConfigured && (
        <a className={LINK} href={slackStartUrl({ agentId, returnTo })}>
          Change
        </a>
      )}
      <button type="button" className={cn(LINK, "text-stone-600")} onClick={handleDisconnect} disabled={isBusy}>
        {isBusy ? <Loader2 className="inline size-3 animate-spin" aria-hidden /> : null} Disconnect
      </button>
    </div>
  );
}

/** Compact status line for a top bar or settings page. Renders nothing until loaded. */
export function MySlackStatus({ className }: { className?: string }) {
  const { me } = useMe();
  if (!me) return null;
  if (!me.slack) return <SignInWithSlack isConfigured={me.slackOAuth.configured} className={className} />;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] text-stone-700", className)}>
      <Check className="size-3.5 text-emerald-600" aria-hidden />
      <span className="font-mono">#{me.slack.channel}</span>
      <span className="text-stone-500">· {me.slack.team}</span>
    </span>
  );
}
