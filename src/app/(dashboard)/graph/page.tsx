import type { Metadata } from "next";
import { GraphView } from "@/components/graph/graph-view";

export const metadata: Metadata = { title: "How your agents connect · Agent Factory" };

export default function GraphPage() {
  return <GraphView />;
}
