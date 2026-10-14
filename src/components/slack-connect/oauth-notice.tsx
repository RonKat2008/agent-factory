"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const REASONS: Record<string, string> = {
  access_denied: "You cancelled on Slack's screen. Nothing changed.",
  not_configured: "Slack sign-in isn't set up on this site yet. Paste a webhook instead.",
  bad_state: "That sign-in link expired. Try again.",
  rate_limited: "Too many tries. Wait a minute and try again.",
};
let shownFor: string | null = null;

/** Toasts the result of a Slack sign-in (?slack=connected|error) once per page load. Renders nothing. */
export function SlackOAuthNotice() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("slack");
    if (!outcome || shownFor === window.location.search) return;
    shownFor = window.location.search;
    if (outcome === "connected") toast.success("Slack connected. Your agents will post to your channel.");
    else if (outcome === "error") toast.error(REASONS[params.get("reason") ?? ""] ?? "Slack sign-in didn't finish. Try again.");
  }, []);
  return null;
}
