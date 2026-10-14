// Acme's own chrome. Deliberately independent of the Agent Factory UI (it plays a third-party site).
import type { CSSProperties, ReactNode } from "react";
import type { AcmeEntry, AcmeState } from "@/lib/demo-acme";
import { formatDate } from "@/lib/demo-acme";

export const acme = {
  ink: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  bg: "#ffffff",
  soft: "#f8fafc",
  brand: "#4f46e5",
  brandSoft: "#eef2ff",
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

const wrap: CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 20px" };

export function AcmeShell({ state, children }: { state: AcmeState; children: ReactNode }) {
  const changelog = state.broken
    ? { href: "/demo/acme/updates", label: "What's new" }
    : { href: "/demo/acme/changelog", label: "Changelog" };
  const navLink: CSSProperties = { color: acme.muted, textDecoration: "none", fontSize: 14, fontWeight: 500 };
  return (
    <div style={{ minHeight: "100vh", width: "100%", background: acme.bg, color: acme.ink, fontFamily: acme.font }}>
      <nav style={{ borderBottom: `1px solid ${acme.line}`, background: "rgba(255,255,255,0.9)" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 28, height: 64, flexWrap: "wrap" }}>
          <a href="/demo/acme" style={{ display: "flex", alignItems: "center", gap: 10, color: acme.ink, textDecoration: "none", fontWeight: 700, fontSize: 18 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${acme.brand}, #06b6d4)`, display: "inline-block" }} />
            Acme Analytics
          </a>
          <a href="/demo/acme#product" style={navLink}>Product</a>
          <a href="/demo/acme#pricing" style={navLink}>Pricing</a>
          <a href={changelog.href} style={navLink}>{changelog.label}</a>
          <a href="/demo/acme#docs" style={navLink}>Docs</a>
          <span style={{ flex: 1 }} />
          <a href="/demo/acme#signin" style={navLink}>Sign in</a>
          <a href="/demo/acme#trial" style={{ background: acme.ink, color: "#fff", padding: "8px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Start free trial</a>
        </div>
      </nav>
      <main>{children}</main>
      <footer style={{ borderTop: `1px solid ${acme.line}`, marginTop: 80 }}>
        <div style={{ ...wrap, padding: "28px 20px", color: acme.muted, fontSize: 13, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span>© 2026 Acme Analytics, Inc.</span>
          <span>Security · Privacy · Terms · Status</span>
        </div>
      </footer>
    </div>
  );
}

export function Container({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...wrap, ...style }}>{children}</div>;
}

const TAG_COLORS: Record<AcmeEntry["tag"], { bg: string; fg: string }> = {
  New: { bg: "#ecfdf5", fg: "#047857" },
  Improved: { bg: "#eef2ff", fg: "#4338ca" },
  Fixed: { bg: "#fff7ed", fg: "#c2410c" },
};

export function Tag({ tag }: { tag: AcmeEntry["tag"] }) {
  const c = TAG_COLORS[tag];
  return (
    <span style={{ display: "inline-block", background: c.bg, color: c.fg, fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>{tag} </span>
  );
}

/** Entry text is inline spans so scrapers see one line per entry; display:block gives the visual layout. */
export function EntryText({ entry, titleSize = 20 }: { entry: AcmeEntry; titleSize?: number }) {
  return (
    <>
      <span style={{ display: "block", fontSize: 13, color: acme.muted, marginBottom: 6 }}>
        <time dateTime={entry.date}>{formatDate(entry.date)}</time> — <Tag tag={entry.tag} />
      </span>
      <span style={{ display: "block", fontSize: titleSize, fontWeight: 650, letterSpacing: "-0.01em", marginBottom: 6 }}>{entry.title}. </span>
      <span style={{ display: "block", color: "#334155", lineHeight: 1.6 }}>{entry.body}</span>
    </>
  );
}
