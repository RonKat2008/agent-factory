import type { Metadata } from "next";
import { ConnectionsView } from "@/components/connections/connections-view";

export const metadata: Metadata = { title: "Connections · Agent Factory" };

export default function ConnectionsPage() {
  return <ConnectionsView />;
}
