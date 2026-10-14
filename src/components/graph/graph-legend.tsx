import { Term } from "@/components/explain";
import { KIND_COLORS, STATUS_COLORS, VIOLET } from "./palette";

function EdgeSample({ kind }: { kind: "trigger" | "mention" }) {
  return (
    <svg width="26" height="8" aria-hidden className="shrink-0">
      {kind === "trigger" ? (
        <>
          <line x1="0" y1="4" x2="19" y2="4" stroke={VIOLET} strokeWidth="3" />
          <path d="M18 0.5 L25 4 L18 7.5 Z" fill={VIOLET} />
        </>
      ) : (
        <line x1="0" y1="4" x2="26" y2="4" stroke="#78716c" strokeWidth="1" />
      )}
    </svg>
  );
}

/** Knowledge-view key. Entities are colored by kind; the most-mentioned ones are labeled on the map. */
export function GraphLegend() {
  return (
    <div className="absolute bottom-3 left-3 hidden max-w-[270px] rounded-[10px] border border-white/10 bg-[#17171a]/95 p-3 text-[12px] text-stone-300 backdrop-blur sm:block">
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <span className="flex w-[26px] justify-center">
            <span className="size-3.5 rounded-full border-[3px] bg-[#18181b]" style={{ borderColor: STATUS_COLORS.live }} />
          </span>
          Agent
        </li>
        {Object.entries(KIND_COLORS).map(([kind, color]) => (
          <li key={kind} className="flex items-center gap-2">
            <span className="flex w-[26px] justify-center">
              <span className="size-2.5 rounded-full" style={{ background: color }} />
            </span>
            <span className="capitalize">{kind}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 pt-1">
          <EdgeSample kind="trigger" />
          <Term id="chain">Chain</Term>: one agent triggers the next
        </li>
        <li className="flex items-center gap-2">
          <EdgeSample kind="mention" />
          Found by an agent (<Term id="entities">entity</Term>)
        </li>
      </ul>
      <p className="mt-2 border-t border-white/10 pt-2 text-[11.5px] text-stone-500">
        The most-mentioned names are labeled. Hover any dot to see its name.
      </p>
    </div>
  );
}
