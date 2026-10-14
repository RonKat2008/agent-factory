import type { Agent } from "@/lib/types";

export type RecentRun = NonNullable<Agent["recent"]>[number];
export type BarTone = "ok" | "failed" | "repair" | "held";

/** violet = a repair_test or the first run after one; red = failed; stone = held / running; emerald = ok. */
export function classifyRuns(recent: RecentRun[]): BarTone[] {
  let afterRepair = false;
  return recent.map((r) => {
    if (r.kind === "repair_test") {
      afterRepair = true;
      return "repair";
    }
    const tone: BarTone =
      r.status === "failed" ? "failed" : r.status === "succeeded" ? (afterRepair ? "repair" : "ok") : "held";
    afterRepair = false;
    return tone;
  });
}

export function latestRepairAt(recent: RecentRun[] | undefined): string | null {
  if (!recent) return null;
  for (let i = recent.length - 1; i >= 0; i--) if (recent[i].kind === "repair_test") return recent[i].startedAt;
  return null;
}

/** Slack mrkdwn first bullet as plain segments (links preserved, http(s) only). */
export type Seg = { text: string; href?: string };

export function previewSegments(message: string): Seg[] {
  const lines = message.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullet = lines.find((l) => /^[•\-–]\s/.test(l) || /^\*\s/.test(l));
  const line = (bullet ?? lines.find((l) => !/^\*[^*]+\*$/.test(l)) ?? lines[0] ?? "").replace(/^[•\-–*]\s+/, "");
  const segs: Seg[] = [];
  let last = 0;
  const re = /<(https?:\/\/[^|>\s]+)(?:\|([^>]*))?>/g;
  const plain = (t: string) => t.replace(/[*_`]/g, "");
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) segs.push({ text: plain(line.slice(last, m.index)) });
    let label = m[2];
    if (!label) {
      try {
        label = new URL(m[1]).hostname;
      } catch {
        label = m[1];
      }
    }
    segs.push({ text: plain(label), href: m[1] });
    last = m.index + m[0].length;
  }
  if (last < line.length) segs.push({ text: plain(line.slice(last)) });
  return segs;
}
