// The first-visit walkthrough. Each step points at elements marked `data-tour="<id>"`;
// the first visible id in `targets` wins. Steps whose targets are not on the page are skipped.

export type TourStep = {
  key: string;
  targets: readonly string[];
  title: string;
  body: string;
};

export const TOUR_STEPS: readonly TourStep[] = [
  {
    key: "describe",
    targets: ["home-input"],
    title: "Describe a job in one sentence",
    body: "Say what you want done and how often, like “Every weekday at 9, tell #product what our competitors shipped.” That's the whole setup.",
  },
  {
    key: "build",
    targets: ["how-build", "build-log"],
    title: "The factory builds it and tests it before it ever runs",
    body: "It assembles the agent from ready-made blocks, does a test run on real data and checks the result. Only an agent that passes its tests can go live.",
  },
  {
    key: "run",
    targets: ["how-run", "nav-agents"],
    title: "It runs on schedule — here's what it sends you",
    body: "Once live, it runs on its own schedule and posts a short summary to Slack. Everything it sends also lands in your Outbox.",
  },
  {
    key: "repair",
    targets: ["nav-tour", "how-repair"],
    title: "If it breaks, it fixes itself — try it in the Tour",
    body: "When a website changes and a run fails, the factory finds the cause, patches the agent, re-tests it, and tells you what it fixed. The 60-second Tour lets you break one on purpose.",
  },
];

export const ONBOARDED_KEY = "af_onboarded";
