import type { Metadata } from "next";
import { JudgeTour } from "@/components/tour/judge-tour";

export const metadata: Metadata = { title: "The 3-minute tour · Agent Factory" };

export default function TourPage() {
  return <JudgeTour />;
}
