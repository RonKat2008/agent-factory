import type { NextRequest } from "next/server";
import { guard, json, jsonError } from "@/lib/api-util";
import { deleteCustomConnector, getCustomConnector } from "@/lib/repo-connectors";
import { canDelete } from "../shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** Delete: admin session, or the creator's IP within 30 minutes of creating it. */
export function DELETE(request: NextRequest, { params }: Ctx): Promise<Response> {
  return guard("DELETE /api/connectors/:slug", async () => {
    const { slug } = await params;
    const c = await getCustomConnector(slug);
    if (!c) return jsonError("connector not found", 404);
    if (!canDelete(request, c)) return jsonError("Only an admin, or whoever added it in the last 30 minutes, can delete this connector", 403);
    await deleteCustomConnector(slug);
    return json({ deleted: slug });
  });
}
