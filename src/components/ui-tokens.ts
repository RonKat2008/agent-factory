// Shared class-name tokens so every page uses the same panel / label / button / focus styles.
export const LABEL = "font-mono text-[11px] uppercase tracking-[0.12em] text-stone-500";
export const PANEL = "bg-[#FBFAF7] border border-stone-300 rounded-[3px] shadow-[0_1px_0_rgba(0,0,0,0.04)]";
export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40";
export const BTN = `inline-flex items-center justify-center gap-1.5 rounded-[3px] px-3 h-8 text-[13px] font-medium transition-colors ${FOCUS} disabled:opacity-50 disabled:pointer-events-none`;
export const BTN_PRIMARY = `${BTN} bg-stone-900 text-[#F6F4EF] hover:bg-stone-700`;
export const BTN_SECONDARY = `${BTN} border border-stone-300 bg-[#FBFAF7] text-stone-900 hover:bg-stone-100`;
