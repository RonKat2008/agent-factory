import type { Metadata } from "next";
import { TourPanel } from "@/components/tour/tour-panel";

export const metadata: Metadata = { title: "The 60-second tour · Agent Factory" };

export default function TourPage() {
  return <TourPanel />;
}
