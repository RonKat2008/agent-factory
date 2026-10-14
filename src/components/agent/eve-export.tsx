"use client";
import { useState } from "react";
import { Download } from "lucide-react";

type Files = Record<string, string>;

export function EveExport({ agentId }: { agentId: string }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Files | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/agents/${agentId}/export`;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || files) return;
    try {
      const res = await fetch(`${base}?format=json`);
      if (!res.ok) throw new Error(`export failed (${res.status})`);
      setFiles(((await res.json()) as { files: Files }).files);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "export failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={base}
          download
          className="inline-flex items-center gap-2 rounded-[3px] border border-stone-300 bg-[#FBFAF7] px-3 py-1.5 text-[13px] text-stone-900 hover:bg-stone-100"
        >
          <Download className="size-3.5" aria-hidden />
          Export as eve agent
          <span className="rounded-[3px] bg-stone-900 px-1 font-mono text-[10px] text-stone-50">eve</span>
        </a>
        <button
          type="button"
          onClick={() => void toggle()}
          aria-expanded={open}
          className="text-[12px] text-sky-700 underline underline-offset-2"
        >
          {open ? "Hide preview" : "Preview files"}
        </button>
      </div>
      {open && (
        <div className="grid gap-3 border border-stone-300 bg-[#FBFAF7] p-3 md:grid-cols-[minmax(0,220px)_1fr]">
          {error && <p className="text-[12px] text-red-700">{error}</p>}
          {files && (
            <>
              <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-stone-700">
                {Object.keys(files).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-stone-800">
                {files["agent/instructions.md"]}
              </pre>
            </>
          )}
          {!files && !error && <p className="text-[12px] text-stone-500">Loading…</p>}
        </div>
      )}
    </div>
  );
}
