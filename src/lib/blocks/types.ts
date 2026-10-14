import type { BlockResult } from "@/lib/spec";

export type Item = {
  title: string;
  url: string;
  summary?: string;
  points?: number;
  publishedAt?: string;
  number?: number;
  labels?: string[];
  body?: string;
};

export interface BlockContext {
  agentId: string;
  runId: string;
  dryRun: boolean;
  appUrl: string; // process.env.APP_URL
  memoryGet(key: string): Promise<unknown>; // provided by runtime (Task 4)
  memorySet(key: string, value: unknown): Promise<void>;
  deliver(message: string): Promise<{ sent: boolean; error?: string }>; // Slack + outbox, provided by runtime
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BlockRunner = (params: any, ctx: BlockContext) => Promise<BlockResult>;
export type BlockDef = { run: BlockRunner; description: string; params: string; outputs: string };

export const ok = <T extends Record<string, unknown>>(output: T, costUsd?: number): BlockResult =>
  costUsd === undefined ? { ok: true, output } : { ok: true, output, costUsd };
export const fail = (error: string, costUsd?: number): BlockResult =>
  costUsd === undefined ? { ok: false, error } : { ok: false, error, costUsd };
