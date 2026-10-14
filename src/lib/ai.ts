import { isDemoMode } from "@/lib/demo";

export { isDemoMode };

const DEFAULT_SMART_MODEL = "anthropic/claude-sonnet-5.5";
const DEFAULT_FAST_MODEL = "anthropic/claude-haiku-5.5";

/** AI Gateway model id for quality-sensitive calls. */
export function smartModel(): string {
  return process.env.MODEL_SMART || DEFAULT_SMART_MODEL;
}

/** AI Gateway model id for cheap/fast calls. */
export function fastModel(): string {
  return process.env.MODEL_FAST || DEFAULT_FAST_MODEL;
}

type GatewayCostMetadata = { gateway?: { cost?: string | number; marketCost?: string | number } };

/** USD cost reported by AI Gateway in providerMetadata.gateway.cost (string); 0 if absent. */
export function callCostUsd(result: { providerMetadata?: unknown }): number {
  const meta = result.providerMetadata as GatewayCostMetadata | undefined;
  const cost = Number(meta?.gateway?.cost ?? 0);
  return Number.isFinite(cost) ? cost : 0;
}
