"use client";

import { cn } from "@/lib/utils";

export type Destination = "team" | "own";
export const TEAM_CHANNEL = "factory-demo";
export const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/-]+$/;

type Props = {
  destination: Destination;
  onDestination: (d: Destination) => void;
  webhook: string;
  onWebhook: (v: string) => void;
  hasSavedWebhook: boolean;
  disabled?: boolean;
};

function Option({ on, label, hint, onSelect, disabled }: { on: boolean; label: string; hint: string; onSelect: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex flex-1 items-start gap-2.5 rounded-[4px] border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/50 disabled:opacity-60",
        on ? "border-stone-900 bg-white" : "border-stone-300 bg-[#FBFAF7] hover:border-stone-500",
      )}
    >
      <span className={cn("mt-1 grid size-3.5 shrink-0 place-items-center rounded-full border-2", on ? "border-violet-700" : "border-stone-400")} aria-hidden>
        {on && <span className="size-1.5 rounded-full bg-violet-700" />}
      </span>
      <span>
        <span className="block text-[14px] font-medium text-stone-900">{label}</span>
        <span className="block text-[12.5px] text-stone-500">{hint}</span>
      </span>
    </button>
  );
}

export function SendTo({ destination, onDestination, webhook, onWebhook, hasSavedWebhook, disabled }: Props) {
  const invalid = destination === "own" && webhook.trim() !== "" && !SLACK_WEBHOOK_RE.test(webhook.trim());
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="text-[15px] font-semibold text-stone-900">Where should it send?</legend>
      <div role="radiogroup" aria-label="Where should it send?" className="flex flex-col gap-2 sm:flex-row">
        <Option on={destination === "team"} label={`Team channel (#${TEAM_CHANNEL})`} hint="Works right away" onSelect={() => onDestination("team")} />
        <Option on={destination === "own"} label="My own Slack channel" hint="Takes about 2 minutes to set up" onSelect={() => onDestination("own")} />
      </div>
      {destination === "own" && (
        <div className="rounded-[4px] border border-stone-300 bg-white p-3">
          <label htmlFor="own-webhook" className="text-[13px] font-medium text-stone-800">
            Your Slack webhook URL
          </label>
          <input
            id="own-webhook"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={webhook}
            onChange={(e) => onWebhook(e.target.value)}
            placeholder={hasSavedWebhook ? "Saved. Paste a new one to replace it" : "https://hooks.slack.com/services/…"}
            aria-invalid={invalid}
            aria-describedby="webhook-help"
            className={cn(
              "mt-1.5 h-10 w-full rounded-[4px] border bg-[#FBFAF7] px-2.5 font-mono text-[13px] text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/50",
              invalid ? "border-red-400" : "border-stone-300",
            )}
          />
          {invalid && <p className="mt-1 text-[12.5px] text-red-700">That isn’t a Slack webhook. It starts with https://hooks.slack.com/services/</p>}
          <ol id="webhook-help" className="mt-2.5 list-decimal space-y-0.5 pl-5 text-[13px] text-stone-600">
            <li>
              Go to{" "}
              <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="font-medium text-violet-700 underline underline-offset-2">
                api.slack.com/apps
              </a>{" "}
              and click <strong>Create New App</strong> → From scratch.
            </li>
            <li>Open <strong>Incoming Webhooks</strong>, switch it on, then <strong>Add New Webhook</strong> and pick your channel.</li>
            <li>Copy the webhook URL and paste it here.</li>
          </ol>
        </div>
      )}
    </fieldset>
  );
}
