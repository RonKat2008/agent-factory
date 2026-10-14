import type { CallOutput } from "./connectors-api";
import { LABEL } from "./parts";

const MAX_PREVIEW = 1200;

/** Compact response preview: status, item count and the first ~1.2k chars of the body. */
export function ResultPreview({ result }: { result: CallOutput }) {
  const body = result.text.length > MAX_PREVIEW ? `${result.text.slice(0, MAX_PREVIEW)}\n…` : result.text;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-800">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          {result.status} OK
        </span>
        {result.items ? <span className="font-mono text-[11px] text-stone-500">{result.items.length} items</span> : null}
        {result.truncated ? <span className="font-mono text-[11px] text-amber-700">response truncated</span> : null}
        <span className={`${LABEL} ml-auto`}>Response preview</span>
      </div>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-[3px] border border-stone-300 bg-stone-950 p-3 font-mono text-[11.5px] leading-relaxed text-stone-100">{body || "(empty body)"}</pre>
    </div>
  );
}
