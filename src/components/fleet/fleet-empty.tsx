import Link from "next/link";
import { ReplayIntroButton } from "@/components/onboarding";
import { BTN_PRIMARY } from "@/components/ui-tokens";

/** An empty conveyor belt: three dashed slots waiting for agents, one violet spark. */
function EmptyBelt() {
  return (
    <svg viewBox="0 0 220 96" className="h-auto w-[220px] max-w-full" aria-hidden>
      <rect x="6" y="58" width="208" height="22" rx="11" className="fill-stone-100 stroke-stone-300" strokeWidth="1.5" />
      {[28, 110, 192].map((cx) => (
        <circle key={cx} cx={cx} cy="69" r="5" className="fill-[#FBFAF7] stroke-stone-300" strokeWidth="1.5" />
      ))}
      {[30, 90, 150].map((x) => (
        <rect
          key={x}
          x={x}
          y="22"
          width="40"
          height="32"
          rx="4"
          className="fill-none stroke-stone-400"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      ))}
      <path d="M170 8 L173 16 L181 19 L173 22 L170 30 L167 22 L159 19 L167 16 Z" className="fill-violet-600" />
    </svg>
  );
}

export function FleetEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[4px] border border-dashed border-stone-400 bg-[#FBFAF7] px-6 py-14 text-center">
      <EmptyBelt />
      <div className="space-y-1.5">
        <h2 className="text-[20px] font-semibold tracking-tight text-stone-900">No agents yet</h2>
        <p className="max-w-sm text-[14px] text-stone-600">
          Describe a job in one sentence and the factory builds it for you.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className={BTN_PRIMARY}>
          Build your first agent
        </Link>
        <ReplayIntroButton>Show me around</ReplayIntroButton>
      </div>
    </div>
  );
}
