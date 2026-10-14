import type { Metadata } from "next";
import { JudgeTour } from "@/components/tour/judge-tour";

export const metadata: Metadata = { title: "Formation lap · Pitcrew" };

export default function TourPage() {
  return <JudgeTour />;
}
