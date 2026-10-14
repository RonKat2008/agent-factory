import { AgentDetailView } from "@/components/agent/agent-detail-view";

// Next 16: dynamic route params are a Promise.
export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentDetailView id={id} />;
}
