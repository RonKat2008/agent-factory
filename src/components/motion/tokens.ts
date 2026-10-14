// Motion tokens for Agent Factory. Every animated component imports its timing from here;
// no inline durations, easings or spring configs elsewhere. Plain module (no "use client").

export const DURATION = {
  instant: 0.08,
  fast: 0.18,
  normal: 0.32,
  slow: 0.6,
  crawl: 1.0,
} as const;

export const EASE = {
  /** Default for entrances: fast out, soft landing. */
  out: [0.16, 1, 0.3, 1],
  /** Symmetric moves (spotlight travel, crossfades). */
  inOut: [0.65, 0, 0.35, 1],
  /** Exits: quick and quiet. */
  in: [0.4, 0, 1, 1],
} as const;

export const DISTANCE = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 24,
} as const;

export const SPRING = {
  /** Buttons, chips, pills. */
  snappy: { type: "spring", stiffness: 420, damping: 34 },
  /** Panels, cards, list rows landing. */
  gentle: { type: "spring", stiffness: 170, damping: 24 },
  /** Onboarding spotlight / caption travel between targets. */
  glide: { type: "spring", stiffness: 140, damping: 22, mass: 0.9 },
  /** Celebratory finish (repair done). Use once per moment. */
  bouncy: { type: "spring", stiffness: 380, damping: 14 },
  /** Number tickers. */
  ticker: { stiffness: 90, damping: 22, mass: 0.8 },
} as const;

/** Stagger interval between siblings (keep within 0.05–0.10s). */
export const STAGGER = { tight: 0.05, normal: 0.07, loose: 0.1 } as const;

/** Semantic tones shared by Pulse / StatusMorph. Matches the control-room palette. */
export const TONE = {
  violet: "rgb(124 58 237)", // factory-made / repair
  emerald: "rgb(5 150 105)", // success / live
  amber: "rgb(217 119 6)", // repairing / warning
  red: "rgb(220 38 38)", // broken
  sky: "rgb(2 132 199)", // building / testing
  stone: "rgb(68 64 60)",
} as const;

export type Tone = keyof typeof TONE;
