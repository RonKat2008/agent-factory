import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Describe", "Check the plan", "Preview & turn on"] as const;

export type StepIndex = 0 | 1 | 2;

export function Stepper({ current }: { current: StepIndex }) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border-2 text-[13px] font-semibold transition-colors",
                  done && "border-stone-900 bg-stone-900 text-[#F6F4EF]",
                  active && "border-violet-700 bg-violet-700 text-white",
                  !done && !active && "border-stone-300 text-stone-400",
                )}
              >
                {done ? <Check className="size-3.5" aria-label="Done" /> : i + 1}
              </span>
              <span className={cn("truncate text-[14px]", active ? "font-semibold text-stone-900" : done ? "text-stone-700" : "text-stone-400")}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className={cn("hidden h-px flex-1 sm:block", done ? "bg-stone-900" : "bg-stone-300")} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
