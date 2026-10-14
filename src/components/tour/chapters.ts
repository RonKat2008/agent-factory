// The judge tour: eight chapters, one per feature. Order is the story order.
export type ChapterId = "build" | "repair" | "chain" | "graph" | "steer" | "ops" | "connect" | "hood";

export type ChapterMeta = { id: ChapterId; title: string; short: string };

export const CHAPTERS: readonly ChapterMeta[] = [
  { id: "build", title: "Build an agent from one sentence", short: "Build from a sentence" },
  { id: "repair", title: "Pit stop: it fixes itself", short: "Pit stop" },
  { id: "chain", title: "Chain reaction", short: "Agents trigger agents" },
  { id: "graph", title: "See the whole system", short: "See the system" },
  { id: "steer", title: "Steer it in plain English", short: "Steer in plain English" },
  { id: "ops", title: "Ask your fleet", short: "Ask your fleet" },
  { id: "connect", title: "Connect anything", short: "Connect anything" },
  { id: "hood", title: "Under the hood", short: "Under the hood" },
];

export const TOUR_PROGRESS_KEY = "af-judge-tour";
/** Set when the tour sends you elsewhere; shows the "back to the tour" pill. */
export const TOUR_RETURN_KEY = "af-tour-return";

export const GITHUB_URL = "https://github.com/RonKat2008/agent-factory";

export function markLeavingTour(): void {
  try {
    sessionStorage.setItem(TOUR_RETURN_KEY, "1");
  } catch {
    /* storage unavailable: no pill, fine */
  }
}

/** Turns a failed call into a judge-friendly sentence. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const wait = /(\d+)\s*s\b/.exec(msg);
  if (/429|too many|rate|try again/i.test(msg)) {
    return wait ? `Someone just did this. Try again in ${wait[1]}s.` : "Someone just did this. Give it a few seconds and try again.";
  }
  return msg || "Something went wrong. Try again.";
}
