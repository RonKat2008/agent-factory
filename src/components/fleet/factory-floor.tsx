import { CheckCircle2 } from "lucide-react";
import type { Agent } from "@/lib/types";
import { LABEL, PANEL } from "@/components/ui-tokens";
import { buildFloorData, HOUR_MS, WINDOW_H, type FloorData } from "./floor-data";

const W = 300;
const SURFACE = "#FBFAF7";
const TXT = "fill-stone-500 font-mono text-[9px]";

function Card({ title, value, unit, children, legend }: { title: string; value: string; unit: string; children: React.ReactNode; legend?: React.ReactNode }) {
  return (
    <figure className={`${PANEL} min-w-0 p-3`}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className={LABEL}>{title}</span>
        <span className="font-mono text-[20px] font-semibold leading-none tabular-nums text-stone-900">
          {value} <span className="text-[11px] font-normal text-stone-500">{unit}</span>
        </span>
      </figcaption>
      <div className="mt-2">{children}</div>
      {legend && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-600">{legend}</div>}
    </figure>
  );
}

function Key({ className, label, round = false }: { className: string; label: string; round?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-2 ${round ? "rounded-full" : "rounded-[1px]"} ${className}`} aria-hidden />
      {label}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="flex h-[96px] items-center justify-center gap-1.5 text-[13px] text-stone-500">{children}</p>;
}

function RunsPerHour({ d, now }: { d: FloorData; now: number }) {
  const H = 90;
  const base = H - 14;
  const top = 12;
  const max = Math.max(2, ...d.hourly.map((b) => b.ok + b.failed));
  const slot = W / WINDOW_H;
  const bw = slot - 4;
  const y = (n: number) => (n / max) * (base - top);
  const failedTotal = d.hourly.reduce((s, b) => s + b.failed, 0);
  const label = `Runs per hour over the last ${WINDOW_H} hours: ${d.runsInWindow} total, ${failedTotal} failed.`;
  return (
    <Card
      title="Runs per hour"
      value={String(d.runsInWindow)}
      unit={`in ${WINDOW_H}h`}
      legend={
        <>
          <Key className="bg-emerald-600" label="ok" />
          <Key className="bg-red-600" label="failed" />
        </>
      }
    >
      {d.runsInWindow === 0 ? (
        <Empty>No runs in the last {WINDOW_H}h</Empty>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
          <line x1={0} x2={W} y1={base - y(max)} y2={base - y(max)} className="stroke-stone-200" strokeDasharray="2 3" />
          <text x={0} y={base - y(max) - 3} className={TXT}>{max}</text>
          {d.hourly.map((b, i) => {
            const x = i * slot + 2;
            const okH = y(b.ok);
            const failH = y(b.failed);
            const when = new Date(b.from).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
            return (
              <g key={b.from} className="[&:hover_rect]:opacity-80">
                <title>{`${when}: ${b.ok} ok, ${b.failed} failed`}</title>
                <rect x={x} y={0} width={bw} height={base} fill="transparent" />
                {b.ok > 0 && <rect x={x} y={base - okH} width={bw} height={okH} rx={1.5} className="fill-emerald-600" stroke={SURFACE} strokeWidth={1} />}
                {b.failed > 0 && <rect x={x} y={base - okH - failH} width={bw} height={failH} rx={1.5} className="fill-red-600" stroke={SURFACE} strokeWidth={1} />}
              </g>
            );
          })}
          <line x1={0} x2={W} y1={base + 0.5} y2={base + 0.5} className="stroke-stone-300" />
          <text x={0} y={H - 2} className={TXT}>{WINDOW_H}h ago</text>
          <text x={W / 2} y={H - 2} textAnchor="middle" className={TXT}>{WINDOW_H / 2}h</text>
          <text x={W} y={H - 2} textAnchor="end" className={TXT}>{new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</text>
        </svg>
      )}
    </Card>
  );
}

const usd = (n: number) => `$${n.toFixed(4)}`;

function CostTrend({ d }: { d: FloorData }) {
  const H = 90;
  const padT = 14;
  const padB = 6;
  const s = d.costSeries;
  const max = Math.max(...s) * 1.15 || 1;
  const px = (i: number) => 4 + (i / (s.length - 1)) * (W - 12);
  const py = (v: number) => H - padB - (v / max) * (H - padT - padB);
  const last = s[s.length - 1];
  const label = `Cost per run, 5-run rolling average over the last ${s.length} runs, latest ${usd(last ?? 0)}.`;
  return (
    <Card title="Cost per run" value={d.avgCost == null ? "—" : usd(d.avgCost)} unit="avg" legend={<Key className="bg-stone-700" label="5-run rolling average" />}>
      {s.length < 2 ? (
        <Empty>Not enough runs yet</Empty>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
          <line x1={0} x2={W} y1={H - padB + 0.5} y2={H - padB + 0.5} className="stroke-stone-300" />
          <line x1={0} x2={W} y1={py(max / 1.15)} y2={py(max / 1.15)} className="stroke-stone-200" strokeDasharray="2 3" />
          <text x={0} y={py(max / 1.15) - 3} className={TXT}>{usd(max / 1.15)}</text>
          <polyline
            points={s.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ")}
            fill="none"
            className="stroke-stone-700"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {s.map((v, i) => (
            <circle key={i} cx={px(i)} cy={py(v)} r={7} fill="transparent">
              <title>{`Run ${i + 1} of ${s.length}: ${usd(v)} (rolling avg)`}</title>
            </circle>
          ))}
          <circle cx={px(s.length - 1)} cy={py(last)} r={4} className="fill-stone-900" stroke={SURFACE} strokeWidth={2} />
        </svg>
      )}
    </Card>
  );
}

function RepairsOverTime({ d, now }: { d: FloorData; now: number }) {
  const start = now - WINDOW_H * HOUR_MS;
  const lanes = [...new Set(d.events.map((e) => e.agentName))].slice(0, 3);
  const laneH = 30;
  const H = Math.max(1, lanes.length) * laneH + 16;
  const x = (t: number) => 6 + ((t - start) / (WINDOW_H * HOUR_MS)) * (W - 14);
  const failed = d.events.filter((e) => e.type === "failed").length;
  const label = `Failures and automatic repairs over the last ${WINDOW_H} hours: ${failed} failed runs, ${d.repairCount} repairs.`;
  return (
    <Card
      title="Repairs over time"
      value={String(d.repairCount)}
      unit={`in ${WINDOW_H}h`}
      legend={
        <>
          <Key className="bg-red-600" label="failed run" round />
          <Key className="rotate-45 bg-violet-600" label="repair verified" />
        </>
      }
    >
      {lanes.length === 0 ? (
        <Empty>
          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> No failures in {WINDOW_H}h
        </Empty>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
          {lanes.map((name, li) => {
            const cy = li * laneH + 22;
            return (
              <g key={name}>
                <text x={0} y={cy - 12} className={TXT}>{name.length > 34 ? `${name.slice(0, 33)}…` : name}</text>
                <line x1={0} x2={W} y1={cy} y2={cy} className="stroke-stone-300" strokeDasharray="1 3" />
                {d.events
                  .filter((e) => e.agentName === name)
                  .map((e, i) => {
                    const when = new Date(e.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
                    return e.type === "failed" ? (
                      <circle key={i} cx={x(e.t)} cy={cy} r={4} className="fill-red-600" stroke={SURFACE} strokeWidth={2}>
                        <title>{`${when} run failed`}</title>
                      </circle>
                    ) : (
                      <rect key={i} x={x(e.t) - 4} y={cy - 4} width={8} height={8} className="fill-violet-600" stroke={SURFACE} strokeWidth={2} transform={`rotate(45 ${x(e.t)} ${cy})`}>
                        <title>{`${when} repair verified`}</title>
                      </rect>
                    );
                  })}
              </g>
            );
          })}
          <line x1={0} x2={W} y1={H - 12} y2={H - 12} className="stroke-stone-300" />
          <text x={0} y={H - 2} className={TXT}>{WINDOW_H}h ago</text>
          <text x={W} y={H - 2} textAnchor="end" className={TXT}>now</text>
        </svg>
      )}
    </Card>
  );
}

export function FactoryFloor({ agents, now }: { agents: Agent[]; now: number }) {
  const d = buildFloorData(agents, now);
  return (
    <section aria-label="Factory floor" className="mt-4">
      <h2 className={`mb-2 ${LABEL}`}>Factory floor</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <RunsPerHour d={d} now={now} />
        <CostTrend d={d} />
        <RepairsOverTime d={d} now={now} />
      </div>
    </section>
  );
}
