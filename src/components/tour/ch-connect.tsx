"use client";

import Link from "next/link";
import { ArrowRight, Plug, Plus } from "lucide-react";
import { BTN_SECONDARY } from "@/components/ui-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { SignInWithSlack, useMe } from "@/components/slack-connect";
import { cn } from "@/lib/utils";
import { ChapterShell } from "./chapter-shell";
import { markLeavingTour } from "./chapters";

const BUILT_IN = ["Fetch a page", "RSS and GitHub releases", "Hacker News", "GitHub issues", "Summarize with AI", "Spot what changed", "Run code (Sandbox)", "Ask before posting", "Slack"];
const COMMUNITY = [
  { name: "Exa", what: "neural web search (MCP)" },
  { name: "Kernel", what: "real browsers in the cloud (MCP)" },
  { name: "Context7", what: "up-to-date library docs (MCP)" },
  { name: "DeepWiki", what: "answers about any GitHub repo (MCP)" },
];

function SlackStatus() {
  const { me, isLoading, error } = useMe();
  if (isLoading) return <Skeleton className="h-9 w-48 rounded-[3px]" />;
  if (error) return <p className="text-[13px] text-stone-500">Could not check your Slack status right now.</p>;
  if (me?.user) {
    return (
      <p className="text-[13.5px] text-stone-700">
        Signed in as <strong>{me.user.name}</strong> ({me.user.team}){me.slack ? <>. Your agents post to <strong>#{me.slack.channel}</strong>.</> : "."}
      </p>
    );
  }
  return <SignInWithSlack returnTo="/tour" isConfigured={me?.slackOAuth.configured ?? false} />;
}

function ConnectTry() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[13.5px] font-semibold text-stone-900">Built in</p>
          <ul className="flex flex-wrap gap-1.5">
            {BUILT_IN.map((b) => (
              <li key={b} className="rounded-[3px] border border-stone-300 bg-white px-2 py-1 text-[13px] text-stone-800">{b}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-[13.5px] font-semibold text-stone-900">Added by the community</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {COMMUNITY.map((c) => (
              <li key={c.name} className="flex items-center gap-2 rounded-[3px] border border-violet-200 bg-violet-50/60 px-2.5 py-1.5 text-[13px]">
                <Plug className="size-3.5 shrink-0 text-violet-700" aria-hidden />
                <span><strong className="text-stone-900">{c.name}</strong> <span className="text-stone-600">{c.what}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/connections" onClick={markLeavingTour} className={cn(BTN_SECONDARY, "h-9")}>
            Browse connections <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          <Link href="/connections/build" onClick={markLeavingTour} className={cn(BTN_SECONDARY, "h-9")}>
            <Plus className="size-3.5" aria-hidden /> Add your own
          </Link>
        </div>
      </div>
      <div className="space-y-3 rounded-[3px] border border-stone-300 bg-white p-4">
        <p className="text-[14px] font-semibold text-stone-900">Get agents in your own Slack</p>
        <p className="text-[13.5px] leading-relaxed text-stone-600">One click signs you in and picks the channel your agents post to. No bot tokens to copy.</p>
        <SlackStatus />
      </div>
    </div>
  );
}

export function ChapterConnect() {
  return (
    <ChapterShell
      n={7}
      title="Connect anything"
      lede={
        <p>
          Agents are assembled from connectors. A handful are built in, and anyone can add another by pasting an MCP server or HTTP API. Once added, Pitcrew can use it in any agent it builds, the same way the deep-dive uses Exa.
        </p>
      }
      different={<p>Pitcrew decides which connectors a job needs from your sentence. You never pick tools or wire inputs and outputs by hand, and a new community connector makes every future agent more capable.</p>}
      tryIt={<ConnectTry />}
      products={["MCP", "Sandbox", "Neon"]}
      hood={
        <p>
          Connectors are stored in Neon with their tool schemas, so the build model sees them as blocks it can plan with. MCP tools are called over HTTP at run time; anything that needs to run code goes to a Vercel Sandbox. Sign in with Slack is a standard OAuth flow that saves only your workspace, channel and a token on the server.
        </p>
      }
    />
  );
}
