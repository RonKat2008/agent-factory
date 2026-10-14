import { start, getRun } from "workflow/api";
import { spikeWorkflow } from "@/workflows/spike";

export const dynamic = "force-dynamic";

export async function POST() {
  const run = await start(spikeWorkflow, ["hello"]);
  return Response.json({ runId: run.runId });
}

export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) return Response.json({ error: "runId required" }, { status: 400 });
  const run = getRun(runId);
  if (!(await run.exists)) return Response.json({ error: "not found" }, { status: 404 });
  const status = await run.status;
  const result = status === "completed" ? await run.returnValue : undefined;
  return Response.json({ runId, status, result });
}
