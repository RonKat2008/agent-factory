import { Fragment } from "react";
import type { ReactNode } from "react";
import type { OutboxMessage } from "@/lib/types";
import { clockTime } from "@/components/time";

/** Renders Slack mrkdwn (*bold*, <url|label>) as React nodes. No HTML injection. */
function mrkdwn(text: string): ReactNode[] {
  return text.split(/(\*[^*\n]+\*|<[^>|]+\|[^>]+>)/g).map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <strong key={i}>{part.slice(1, -1)}</strong>;
    const link = /^<([^>|]+)\|([^>]+)>$/.exec(part);
    if (link) return <span key={i} className="text-[#1264A3] underline decoration-[#1264A3]/40">{link[2]}</span>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function SlackPost({ message, label }: { message: OutboxMessage; label: string }) {
  return (
    <figure className="feed-row-enter overflow-hidden rounded-[3px] border border-stone-300 bg-white">
      <figcaption className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-3 py-1.5 font-mono text-[11px] text-stone-500">
        <span aria-hidden className="size-2 rounded-[2px] bg-violet-600" />
        {label}
        <time className="ml-auto tabular-nums" dateTime={message.createdAt}>{clockTime(message.createdAt)}</time>
      </figcaption>
      <div className="flex gap-2.5 px-3 py-2.5">
        <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[4px] bg-stone-900 font-mono text-[12px] font-bold text-[#F6F4EF]">AF</span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-stone-900">Agent Factory <span className="ml-1 rounded-[2px] bg-stone-200 px-1 font-mono text-[10px] font-medium text-stone-600">APP</span></p>
          <p className="whitespace-pre-wrap break-words text-[13.5px] leading-snug text-stone-800">{mrkdwn(message.body)}</p>
        </div>
      </div>
    </figure>
  );
}
