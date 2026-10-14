"use client";

import type { ReactNode } from "react";
import { BookOpen, Clock, MessageSquare, PenLine } from "lucide-react";
import type { AgentSpec, PlanCard } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { SchedulePicker } from "./schedule-picker";
import { type SchedulePick, humanSchedule } from "./schedule";
import { sourcesFromSpec } from "./plain";

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[6px] border border-stone-300 bg-[#FBFAF7] p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-stone-900">
        <span className="grid size-7 place-items-center rounded-full bg-violet-100 text-violet-800">{icon}</span>
        {title}
      </h3>
      <div className="mt-3 text-[15px] leading-relaxed text-stone-800">{children}</div>
    </section>
  );
}

const DEFAULT_PICK: SchedulePick = { freq: "daily", day: 1, time: "09:00" };

const Lines = () => (
  <div className="space-y-2" aria-busy="true">
    <Skeleton className="h-4 w-4/5 rounded-[2px]" />
    <Skeleton className="h-4 w-3/5 rounded-[2px]" />
  </div>
);

type Props = {
  plan: PlanCard | null;
  spec: AgentSpec | null;
  pick: SchedulePick | null;
  onPick: (p: SchedulePick) => void;
  canEdit: boolean;
};

export function PlanStep({ plan, spec, pick, onPick, canEdit }: Props) {
  const sources = spec ? sourcesFromSpec(spec) : [];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card icon={<Clock className="size-3.5" aria-hidden />} title="When">
        {!spec && !plan ? (
          <Lines />
        ) : pick && canEdit ? (
          <SchedulePicker value={pick} onChange={onPick} />
        ) : (
          <>
            <p>{spec ? humanSchedule(spec.schedule) : plan?.runs}</p>
            {canEdit ? (
              <button
                type="button"
                onClick={() => onPick(DEFAULT_PICK)}
                className="mt-2 text-[13px] font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
              >
                Pick a different time
              </button>
            ) : (
              <p className="mt-1 text-[13px] text-stone-500">You can change the time once the build finishes.</p>
            )}
          </>
        )}
      </Card>
      <Card icon={<BookOpen className="size-3.5" aria-hidden />} title="What it reads">
        {sources.length > 0 ? (
          <ul className="space-y-1.5">
            {sources.map((s, i) => (
              <li key={`${s.label}-${i}`} className="min-w-0">
                {s.href ? (
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-900">
                    {s.label}
                  </a>
                ) : (
                  <span className="font-medium text-stone-900">{s.label}</span>
                )}
                {s.detail && <span className="text-stone-500"> · {s.detail}</span>}
              </li>
            ))}
          </ul>
        ) : plan ? (
          <p>{plan.checks}</p>
        ) : (
          <Lines />
        )}
      </Card>
      <Card icon={<PenLine className="size-3.5" aria-hidden />} title="What it writes">
        {plan ? <p>{plan.does}</p> : <Lines />}
      </Card>
      <Card icon={<MessageSquare className="size-3.5" aria-hidden />} title="Where it sends">
        {plan ? (
          <>
            <p>{plan.sendsTo}</p>
            {spec?.requiresApproval && <p className="mt-1 text-[13px] text-amber-800">Asks you first: {plan.asksBefore}</p>}
            <p className="mt-1 text-[13px] text-stone-500">You can pick your own Slack channel on the next step.</p>
          </>
        ) : (
          <Lines />
        )}
      </Card>
    </div>
  );
}
