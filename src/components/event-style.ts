import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  FlaskConical,
  Hammer,
  Hand,
  Link2,
  Loader2,
  Pencil,
  Rocket,
  ShieldCheck,
  ThumbsUp,
  Unlink,
  Wrench,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { EventType } from "@/lib/types";

export type EventStyle = {
  icon: LucideIcon;
  /** text color class for the icon */
  color: string;
  /** left-border + text tone class (compact lists) */
  tone: string;
  spin?: boolean;
  emphasis?: "repair" | "alarm";
};

const RED = { color: "text-red-600", tone: "border-red-600 text-red-800" };
const AMBER = { color: "text-amber-600", tone: "border-amber-600 text-amber-800" };
const VIOLET = { color: "text-violet-600", tone: "border-violet-600 text-violet-800" };
const GREEN = { color: "text-emerald-600", tone: "border-emerald-600 text-emerald-800" };
const STONE = { color: "text-stone-600", tone: "border-stone-300 text-stone-700" };

export const EVENT_STYLES: Record<EventType, EventStyle> = {
  broke: { icon: XCircle, ...RED, emphasis: "repair" },
  repairing: { icon: Loader2, ...AMBER, spin: true, emphasis: "repair" },
  repaired: { icon: Wrench, ...VIOLET, emphasis: "repair" },
  test_failed: { icon: XCircle, ...RED },
  self_fixed: { icon: Zap, ...VIOLET },
  tests_passed: { icon: ShieldCheck, ...GREEN },
  run_succeeded: { icon: CheckCircle2, ...GREEN },
  went_live: { icon: Rocket, ...GREEN },
  run_failed: { icon: XCircle, ...RED },
  feedback: { icon: ThumbsUp, ...STONE },
  paused: { icon: CirclePause, ...STONE, color: "text-stone-500" },
  resumed: { icon: CirclePlay, ...STONE, color: "text-stone-500" },
  approval_needed: { icon: Hand, ...AMBER },
  needs_human: { icon: AlertTriangle, ...RED, emphasis: "alarm" },
  built: { icon: Hammer, ...STONE },
  dry_run: { icon: FlaskConical, ...STONE },
  edited: { icon: Pencil, ...STONE },
  proposed: { icon: Pencil, ...VIOLET },
  triggered: { icon: Link2, color: "text-sky-600", tone: "border-sky-600 text-sky-800" },
  chain_skipped: { icon: Unlink, ...STONE, color: "text-stone-500" },
};

export function eventStyle(type: EventType): EventStyle {
  return EVENT_STYLES[type] ?? EVENT_STYLES.built;
}
