import { KIND_COLORS, STATUS_COLORS, VIOLET } from "./palette";

const ROWS = [
  { label: "Agent", swatch: <span className="size-3.5 rounded-full border-[3px] bg-[#FBFAF7]" style={{ borderColor: STATUS_COLORS.live }} /> },
  { label: "Connector", swatch: <span className="size-3 rounded-[3px] border border-stone-500 bg-stone-200" /> },
];

function EdgeSample({ kind }: { kind: "trigger" | "mention" | "uses" }) {
  return (
    <svg width="26" height="8" aria-hidden className="shrink-0">
      {kind === "trigger" ? (
        <>
          <line x1="0" y1="4" x2="19" y2="4" stroke={VIOLET} strokeWidth="3" />
          <path d="M18 0.5 L25 4 L18 7.5 Z" fill={VIOLET} />
        </>
      ) : kind === "uses" ? (
        <line x1="0" y1="4" x2="26" y2="4" stroke="#78716c" strokeWidth="1.3" strokeDasharray="5 4" />
      ) : (
        <line x1="0" y1="4" x2="26" y2="4" stroke="#a8a29e" strokeWidth="1" />
      )}
    </svg>
  );
}

export function GraphLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 hidden max-w-[260px] rounded-[3px] border border-stone-300 bg-[#FBFAF7]/95 p-2.5 text-[12px] text-stone-700 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:block">
      <ul className="space-y-1.5">
        {ROWS.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <span className="flex w-[26px] justify-center">{r.swatch}</span>
            {r.label}
          </li>
        ))}
        <li className="flex items-start gap-2">
          <span className="flex w-[26px] flex-wrap justify-center gap-0.5 pt-1">
            {Object.values(KIND_COLORS).slice(0, 4).map((c) => (
              <span key={c} className="size-1.5 rounded-full" style={{ background: c }} />
            ))}
          </span>
          <span>
            Entity <span className="text-stone-500">({Object.keys(KIND_COLORS).join(", ")})</span>
          </span>
        </li>
        <li className="flex items-center gap-2"><EdgeSample kind="trigger" />Chain: posts, then triggers</li>
        <li className="flex items-center gap-2"><EdgeSample kind="mention" />Mentioned</li>
        <li className="flex items-center gap-2"><EdgeSample kind="uses" />Uses</li>
      </ul>
    </div>
  );
}
