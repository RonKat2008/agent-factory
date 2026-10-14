"use client";

import { cn } from "@/lib/utils";
import { slackStartUrl } from "./api";
import { SlackLogo } from "./slack-logo";

type Props = {
  agentId?: string | null;
  returnTo?: string;
  /** false renders the disabled "not configured yet" state. */
  isConfigured?: boolean;
  label?: string;
  size?: "md" | "lg";
  className?: string;
};

const BASE =
  "inline-flex items-center justify-center gap-2.5 rounded-[4px] border border-[#DDDDDD] bg-white font-semibold text-[#1D1C1D] shadow-[0_1px_0_rgba(0,0,0,0.06)] transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/50";

/** Slack's "Sign in with Slack" button: one click logs in and picks the channel agents post to. */
export function SignInWithSlack({ agentId, returnTo, isConfigured = true, label = "Sign in with Slack", size = "md", className }: Props) {
  const sizing = size === "lg" ? "h-11 px-4 text-[15px]" : "h-9 px-3 text-[13.5px]";
  if (!isConfigured) {
    return (
      <span className={cn(BASE, sizing, "cursor-not-allowed opacity-60", className)} aria-disabled title="The site owner hasn't added the Slack app keys yet">
        <SlackLogo className={size === "lg" ? "size-5" : "size-4"} />
        Slack sign-in not configured yet
      </span>
    );
  }
  return (
    <a
      // Computed on click so the return path includes the latest query string (agent id, step).
      href={slackStartUrl({ agentId, returnTo: returnTo ?? "/connections" })}
      onClick={(e) => {
        if (!returnTo) e.currentTarget.href = slackStartUrl({ agentId });
      }}
      className={cn(BASE, sizing, "hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(0,0,0,0.10)] active:translate-y-0", className)}
    >
      <SlackLogo className={size === "lg" ? "size-5" : "size-4"} />
      {label}
    </a>
  );
}
