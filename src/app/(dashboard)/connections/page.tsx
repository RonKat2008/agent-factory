import type { Metadata } from "next";
import { ConnectionsView } from "@/components/connections/connections-view";
import { YourSlackRow } from "@/components/slack-connect/your-slack-row";

export const metadata: Metadata = { title: "Connections · Agent Factory" };

export default function ConnectionsPage() {
  return (
    <>
      <YourSlackRow />
      <ConnectionsView />
    </>
  );
}
