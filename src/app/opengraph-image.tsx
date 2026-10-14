import { ImageResponse } from "next/og";

export const alt = "Pitcrew: your AI agents get a pit crew";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STEPS = [
  { label: "404", color: "#dc2626" },
  { label: "diagnosed", color: "#7c3aed" },
  { label: "tested 4/4", color: "#059669" },
  { label: "v2 shipped", color: "#1c1917" },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#F6F4EF",
          backgroundImage:
            "linear-gradient(to right, rgba(28,25,23,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(28,25,23,0.07) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          color: "#1c1917",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width="56" height="56" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="4" fill="#1c1917" />
            <circle cx="16" cy="16" r="8.5" fill="none" stroke="#F6F4EF" strokeWidth="3.5" />
            <circle cx="16" cy="16" r="2.2" fill="#F6F4EF" />
            <path d="M8.5 23.5 19 13" stroke="#7c3aed" strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="21.4" cy="10.6" r="4" fill="#7c3aed" />
            <path d="M21.6 5.6l4.8 4.8-1.9 1.9-4.8-4.8z" fill="#1c1917" />
          </svg>
          <div style={{ marginLeft: 20, fontSize: 30, fontWeight: 700, letterSpacing: 8, fontFamily: "monospace" }}>
            PITCREW
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
          <div style={{ color: "#78716c" }}>Other tools help you build an agent.</div>
          <div>Pitcrew takes responsibility for keeping it running.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", fontFamily: "monospace", fontSize: 28 }}>
          {STEPS.map((s, i) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "10px 18px", background: "#FBFAF7", border: "2px solid #d6d3d1", borderRadius: 4, color: s.color, fontWeight: 700 }}>
                {s.label}
              </div>
              {i < STEPS.length - 1 && <div style={{ margin: "0 14px", color: "#a8a29e" }}>→</div>}
            </div>
          ))}
          <div style={{ marginLeft: 24, color: "#7c3aed", fontWeight: 700 }}>· pit stop 8s</div>
        </div>
      </div>
    ),
    size,
  );
}
