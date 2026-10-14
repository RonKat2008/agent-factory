import Link from "next/link";
import { HomeBuilder } from "@/components/home/home-builder";
import { YourAgents } from "@/components/home/your-agents";
import { SlackPreview } from "@/components/create/slack-preview";

const STEPS = [
  { title: "Describe", body: "Say what you want in one sentence." },
  { title: "We build & test it", body: "You see the exact message before anything is turned on." },
  { title: "It runs every day", body: "And fixes itself if a website changes or a source breaks." },
];

const SAMPLE = `☀️ *San Francisco today:* 64°F and clear, light wind from the west.
Fog rolls back in after 6pm, so bring a layer for the evening.
<https://forecast.weather.gov|Source: National Weather Service>`;

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 py-4 sm:py-8">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <HomeBuilder />
        <aside aria-label="Example of what you'll receive" className="hidden pt-6 lg:block">
          <p className="mb-2 text-[13px] text-stone-500">What lands in your Slack at 8:00 every morning</p>
          <div className="rotate-[0.6deg]">
            <SlackPreview name="SF weather" text={SAMPLE} time="8:00 AM" />
          </div>
        </aside>
      </div>

      <section aria-labelledby="how-heading" className="border-y border-stone-300 py-5">
        <h2 id="how-heading" className="sr-only">
          How it works
        </h2>
        <ol className="grid gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone-900 font-mono text-[13px] text-[#F6F4EF]">
                {i + 1}
              </span>
              <div>
                <p className="text-[15px] font-medium text-stone-900">{s.title}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-stone-600">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[13px] text-stone-600">
          New here?{" "}
          <Link href="/tour" className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900">
            Take the 60-second tour
          </Link>{" "}
          and watch an agent fix itself.
        </p>
      </section>

      <YourAgents />
    </div>
  );
}
