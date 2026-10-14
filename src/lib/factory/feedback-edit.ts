// not_useful + comment -> a proposed (never auto-activated) version, dry-run checked in the background.
import { start } from "workflow/api";
import { getActiveVersion, insertVersion, logEvent } from "@/lib/repo";
import { editAgentWorkflow } from "@/workflows/edit-agent";
import { editSpec } from "./generate";

export async function proposeFromFeedback(agentId: string, comment: string): Promise<number | null> {
  try {
    const active = await getActiveVersion(agentId);
    if (!active) return null;
    const edited = await editSpec(active.spec, `User feedback on the last post: ${comment}`, agentId);
    const version = await insertVersion({
      agentId,
      spec: edited.spec,
      reason: `feedback: ${comment}`,
      createdBy: "factory",
      parentVersion: active.version,
      status: "proposed",
    });
    await start(editAgentWorkflow, [{ agentId, version, changeSummary: edited.changeSummary, autoActivate: false }]);
    return version;
  } catch (e) {
    console.error("[feedback] could not propose an edit:", e);
    await logEvent(agentId, "feedback", `Could not turn feedback into an edit: ${(e as Error).message}`.slice(0, 300));
    return null;
  }
}
