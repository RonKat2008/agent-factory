import { HomeBuilder } from "@/components/home/home-builder";
import { AgentsStrip } from "@/components/home/agents-strip";
import { HowItWorks } from "@/components/home/how-it-works";
import { YourAgents } from "@/components/home/your-agents";
import { SlackPreview } from "@/components/create/slack-preview";
import { FadeIn } from "@/components/motion";

const SAMPLE = `☀️ *San Francisco today:* 64°F and clear, light wind from the west.
Fog rolls back in after 6pm, so bring a layer for the evening.
<https://forecast.weather.gov|Source: National Weather Service>`;

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 py-4 sm:gap-20 sm:py-8">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <HomeBuilder showTourCallout belowInput={<AgentsStrip />} />
        <aside aria-label="Example of what you'll receive" className="hidden pt-6 lg:block">
          <FadeIn delay={0.9} y={24}>
            <p className="mb-2.5 text-[13px] text-stone-500">What lands in your Slack at 8:00 every morning</p>
            <div className="rotate-[0.6deg] rounded-[10px] shadow-[0_18px_40px_-24px_rgba(28,25,23,0.45)] transition-transform duration-300 motion-safe:hover:rotate-0">
              <SlackPreview name="SF weather" text={SAMPLE} time="8:00 AM" channel="daily-weather" />
            </div>
          </FadeIn>
        </aside>
      </div>

      <HowItWorks />

      <YourAgents />
    </div>
  );
}
