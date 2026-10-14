"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { draw, FLASH_MS, PULSE_MS, type ActivePulse, type Flash, type View } from "./draw";
import { WORKING_STATUSES } from "./palette";
import { bounds, createSim, isActive, mergeGraph, reheat, settle, signature, tick, type Sim, type SimNode } from "./sim";
import type { GraphResponse } from "./types";

type Props = {
  graph: GraphResponse | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const MIN_K = 0.2;
const MAX_K = 3.5;
const FRESH_PULSE_MS = 8000;
const CLICK_SLOP = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function GraphCanvas({ graph, selectedId, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const monoProbe = useRef<HTMLSpanElement>(null);

  const sim = useRef<Sim>(createSim());
  const view = useRef<View>({ x: 0, y: 0, k: 1 });
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const hoverId = useRef<string | null>(null);
  const selected = useRef<string | null>(selectedId);
  const pulses = useRef<ActivePulse[]>([]);
  const flashes = useRef<Flash[]>([]);
  const seenPulses = useRef<Set<string>>(new Set());
  const sig = useRef("");
  const userMoved = useRef(false);
  const raf = useRef<number | null>(null);
  const reduced = useRef(false);
  const fonts = useRef({ sans: "system-ui, sans-serif", mono: "ui-monospace, monospace" });
  const onSelectRef = useRef(onSelect);
  const frameRef = useRef<(now: number) => void>(() => {});

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const fitTarget = useCallback((): View | null => {
    const b = bounds(sim.current);
    const { w, h } = size.current;
    if (!b || w === 0) return null;
    const bw = Math.max(1, b.maxX - b.minX);
    const bh = Math.max(1, b.maxY - b.minY);
    const pad = w < 640 ? 24 : 56;
    const k = clamp(Math.min((w - pad * 2) / bw, (h - pad * 2) / bh), MIN_K, 1.25);
    return { k, x: w / 2 - ((b.minX + b.maxX) / 2) * k, y: h / 2 - ((b.minY + b.maxY) / 2) * k };
  }, []);

  const frame = useCallback(
    (now: number) => {
      raf.current = null;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const s = sim.current;
      const simActive = isActive(s);
      if (simActive) tick(s);

      let fitting = false;
      if (!userMoved.current) {
        const t = fitTarget();
        if (t) {
          const v = view.current;
          const lerp = simActive ? 0.12 : 0.2;
          v.x += (t.x - v.x) * lerp;
          v.y += (t.y - v.y) * lerp;
          v.k += (t.k - v.k) * lerp;
          fitting = Math.abs(t.x - v.x) + Math.abs(t.y - v.y) + Math.abs(t.k - v.k) * 100 > 0.5;
        }
      }

      pulses.current = pulses.current.filter((p) => now - p.start < PULSE_MS);
      flashes.current = flashes.current.filter((f) => now - f.start < FLASH_MS);

      const sel = selected.current;
      let neighbors: Set<string> | null = null;
      if (sel) {
        neighbors = new Set();
        for (const e of s.edges) {
          if (e.s.id === sel) neighbors.add(e.t.id);
          if (e.t.id === sel) neighbors.add(e.s.id);
        }
      }
      const { w, h, dpr } = size.current;
      draw(ctx, s, {
        width: w,
        height: h,
        dpr,
        view: view.current,
        hoverId: hoverId.current,
        selectedId: sel,
        neighbors,
        pulses: pulses.current,
        flashes: flashes.current,
        now,
        reduced: reduced.current,
        fonts: fonts.current,
      });

      const working = !reduced.current && s.nodes.some((n) => n.status && WORKING_STATUSES.has(n.status));
      if (simActive || fitting || pulses.current.length > 0 || flashes.current.length > 0 || working) {
        raf.current = requestAnimationFrame((t) => frameRef.current(t));
      }
    },
    [fitTarget],
  );

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  const requestDraw = useCallback(() => {
    if (raf.current === null) raf.current = requestAnimationFrame((t) => frameRef.current(t));
  }, []);

  // setup: sizing, fonts, reduced motion
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onMq = () => {
      reduced.current = mq.matches;
      requestDraw();
    };
    mq.addEventListener("change", onMq);
    if (monoProbe.current) fonts.current.mono = getComputedStyle(monoProbe.current).fontFamily;
    fonts.current.sans = getComputedStyle(wrap).fontFamily;

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      size.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      requestDraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", onMq);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [requestDraw]);

  // data -> sim
  useEffect(() => {
    if (!graph) return;
    const s = sim.current;
    const next = signature(graph);
    const changed = next !== sig.current;
    mergeGraph(s, graph);
    if (changed) {
      sig.current = next;
      reheat(s, 0.6);
      if (reduced.current) {
        settle(s);
        if (!userMoved.current) {
          const t = fitTarget();
          if (t) view.current = t;
        }
      }
    }

    // pulses: animate only fresh ones, never replay old ones on load
    const now = performance.now();
    for (const p of graph.pulses) {
      const key = `${p.edgeId}@${p.at}`;
      if (seenPulses.current.has(key)) continue;
      seenPulses.current.add(key);
      const age = Date.now() - new Date(p.at).getTime();
      if (!(age >= -2000 && age < FRESH_PULSE_MS)) continue;
      const edge = s.edges.find((e) => e.id === p.edgeId);
      if (!edge) continue;
      if (reduced.current) flashes.current.push({ nodeId: edge.t.id, start: now });
      else {
        pulses.current.push({ edgeId: p.edgeId, start: now });
        flashes.current.push({ nodeId: edge.t.id, start: now + PULSE_MS - 200 });
      }
    }
    requestDraw();
  }, [graph, requestDraw, fitTarget]);

  useEffect(() => {
    selected.current = selectedId;
    requestDraw();
  }, [selectedId, requestDraw]);

  // pointer interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: { node: SimNode; moved: boolean; sx: number; sy: number } | null = null;
    let pan: { sx: number; sy: number; vx: number; vy: number; moved: boolean } | null = null;
    let pinch: { dist: number; k: number } | null = null;

    const local = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const toWorld = (p: { x: number; y: number }) => ({
      x: (p.x - view.current.x) / view.current.k,
      y: (p.y - view.current.y) / view.current.k,
    });
    const hit = (p: { x: number; y: number }): SimNode | null => {
      const w = toWorld(p);
      const ns = sim.current.nodes;
      for (let i = ns.length - 1; i >= 0; i--) {
        const n = ns[i];
        const rad = Math.max(n.r + 3, 10 / view.current.k);
        if ((n.x - w.x) ** 2 + (n.y - w.y) ** 2 <= rad * rad) return n;
      }
      return null;
    };
    const zoomAt = (p: { x: number; y: number }, factor: number) => {
      const v = view.current;
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      const wx = (p.x - v.x) / v.k;
      const wy = (p.y - v.y) / v.k;
      view.current = { k, x: p.x - wx * k, y: p.y - wy * k };
      userMoved.current = true;
      requestDraw();
    };

    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: view.current.k };
        drag = null;
        pan = null;
        return;
      }
      const n = hit(p);
      if (n) {
        const w = toWorld(p);
        n.fx = w.x;
        n.fy = w.y;
        drag = { node: n, moved: false, sx: p.x, sy: p.y };
      } else {
        pan = { sx: p.x, sy: p.y, vx: view.current.x, vy: view.current.y, moved: false };
      }
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const target = clamp(pinch.k * (d / Math.max(1, pinch.dist)), MIN_K, MAX_K);
        zoomAt(mid, target / view.current.k);
        return;
      }
      if (drag) {
        if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > CLICK_SLOP) drag.moved = true;
        if (drag.moved) {
          const w = toWorld(p);
          drag.node.fx = w.x;
          drag.node.fy = w.y;
          reheat(sim.current, 0.25);
          requestDraw();
        }
        return;
      }
      if (pan) {
        const dx = p.x - pan.sx;
        const dy = p.y - pan.sy;
        if (Math.hypot(dx, dy) > CLICK_SLOP) pan.moved = true;
        if (pan.moved) {
          view.current = { ...view.current, x: pan.vx + dx, y: pan.vy + dy };
          userMoved.current = true;
          requestDraw();
        }
        return;
      }
      const n = hit(p);
      const id = n?.id ?? null;
      if (id !== hoverId.current) {
        hoverId.current = id;
        canvas.style.cursor = id ? "pointer" : "grab";
        requestDraw();
      }
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag) {
        const { node, moved } = drag;
        node.fx = null;
        node.fy = null;
        drag = null;
        if (!moved) onSelectRef.current(node.id);
        else {
          userMoved.current = true;
          reheat(sim.current, 0.15);
        }
        requestDraw();
      } else if (pan) {
        if (!pan.moved) onSelectRef.current(null);
        pan = null;
      }
    };
    const leave = () => {
      if (hoverId.current) {
        hoverId.current = null;
        requestDraw();
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(local(e), Math.exp(-e.deltaY * 0.0015));
    };

    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [requestDraw]);

  const zoomBy = useCallback(
    (factor: number) => {
      const { w, h } = size.current;
      const v = view.current;
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      const wx = (w / 2 - v.x) / v.k;
      const wy = (h / 2 - v.y) / v.k;
      view.current = { k, x: w / 2 - wx * k, y: h / 2 - wy * k };
      userMoved.current = true;
      requestDraw();
    },
    [requestDraw],
  );
  const fit = useCallback(() => {
    userMoved.current = false;
    if (reduced.current) {
      const t = fitTarget();
      if (t) view.current = t;
    }
    requestDraw();
  }, [fitTarget, requestDraw]);

  const nodeButtons = useMemo(() => graph?.nodes ?? [], [graph]);

  return (
    <div ref={wrapRef} className="relative h-full w-full touch-none overflow-hidden font-sans">
      <span ref={monoProbe} className="font-mono invisible absolute" aria-hidden />
      <canvas ref={canvasRef} className="absolute inset-0 block outline-none" role="img" aria-label="Network graph of agents, connectors and knowledge entities. Use the node list to inspect items." />
      <ul className="sr-only">
        {nodeButtons.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => onSelect(n.id)}>
              {n.type}: {n.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-[3px] border border-stone-300 bg-[#FBFAF7] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <CtlButton label="Zoom in" onClick={() => zoomBy(1.3)}>
          <Plus className="size-4" />
        </CtlButton>
        <CtlButton label="Zoom out" onClick={() => zoomBy(1 / 1.3)}>
          <Minus className="size-4" />
        </CtlButton>
        <CtlButton label="Fit to view" onClick={fit}>
          <Maximize2 className="size-3.5" />
        </CtlButton>
      </div>
    </div>
  );
}

function CtlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center text-stone-700 transition-colors hover:bg-stone-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-900/40 active:bg-stone-200 [&+&]:border-t [&+&]:border-stone-300"
    >
      {children}
    </button>
  );
}
