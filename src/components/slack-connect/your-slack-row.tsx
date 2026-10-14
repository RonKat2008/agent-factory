"use client";

import { ConnectSlackButton } from "./connect-slack-button";
import { SlackLogo } from "./slack-logo";
import { SlackOAuthNotice } from "./oauth-notice";

/** "Connect your own Slack" row for any visitor, separate from the admin-gated team connection. */
export function YourSlackRow() {
  return (
    <section
      aria-labelledby="your-slack-heading"
      className="mb-6 flex flex-col gap-3 rounded-[3px] border border-stone-300 bg-[#FBFAF7] p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:justify-between"
    >
      <SlackOAuthNotice />
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[3px] border border-stone-300 bg-white">
          <SlackLogo className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="your-slack-heading" className="text-[14px] font-semibold text-stone-900">
            Connect your own Slack
          </h2>
          <p className="text-[12.5px] leading-snug text-stone-600">
            Sign in with Slack and pick a channel. Agents you create post there instead of the team channel. No admin key needed.
          </p>
        </div>
      </div>
      <ConnectSlackButton returnTo="/connections" className="shrink-0" />
    </section>
  );
}
