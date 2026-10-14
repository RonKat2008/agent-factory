import { ok, type BlockRunner } from "./types";

export const requireApproval: BlockRunner = async (params) =>
  ok({ needsApproval: true, message: typeof params?.message === "string" ? params.message : "" });
