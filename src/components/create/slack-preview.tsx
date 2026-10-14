import { SlackMessage } from "@/components/slack-message";
import { cn } from "@/lib/utils";

type Props = { name: string; text: string; time?: string; channel?: string; className?: string };

/** A Slack-style message: app avatar, bot name, APP badge, time, mrkdwn body. */
export function SlackPreview({ name, text, time = "9:00 AM", channel, className }: Props) {
  return (
    <figure className={cn("overflow-hidden rounded-[8px] border border-stone-300 bg-white shadow-[0_18px_40px_-24px_rgba(28,25,23,0.5)]", className)}>
      {channel && (
        <figcaption className="flex items-center gap-1.5 border-b border-stone-200 bg-stone-50 px-4 py-2 text-[13px] font-semibold text-stone-800">
          <span className="text-stone-400">#</span>
          {channel}
        </figcaption>
      )}
      <div className="flex gap-3 px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-violet-700 text-[15px] font-bold text-white" aria-hidden>
          {name.trim().charAt(0).toUpperCase() || "A"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[15px] font-bold text-stone-900">{name}</span>
            <span className="rounded-[3px] bg-stone-200 px-1 text-[10px] font-semibold text-stone-600">APP</span>
            <span className="text-[12px] text-stone-500">{time}</span>
          </p>
          <SlackMessage text={text} className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-[1.5] text-stone-900" />
        </div>
      </div>
    </figure>
  );
}
