import { Suspense } from "react";
import { CreateFlow } from "@/components/create/create-flow";

export default function NewAgentPage() {
  return (
    <Suspense fallback={null}>
      <CreateFlow />
    </Suspense>
  );
}
