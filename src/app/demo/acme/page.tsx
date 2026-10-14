import type { Metadata } from "next";
import { getAcmeState, visibleEntries, formatDate } from "@/lib/demo-acme";
import { AcmeShell, Container, acme } from "./_shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Acme Analytics — product analytics for B2B teams" };

const FEATURES = [
  { title: "Event pipelines", body: "Collect product events from any SDK and query them in seconds." },
  { title: "Dashboards", body: "Drag-and-drop charts your whole team can read, with alerts built in." },
  { title: "Governance", body: "SSO, audit logs and data retention controls for regulated teams." },
];

export default async function AcmeHome() {
  const state = await getAcmeState();
  const latest = visibleEntries(state)[0];
  const changelogHref = state.broken ? "/demo/acme/updates" : "/demo/acme/changelog";
  return (
    <AcmeShell state={state}>
      <section style={{ background: `radial-gradient(1200px 400px at 50% -10%, ${acme.brandSoft}, #fff)` }}>
        <Container style={{ padding: "88px 20px 72px", textAlign: "center" }}>
          <a href={changelogHref} style={{ display: "inline-block", border: `1px solid ${acme.line}`, borderRadius: 999, padding: "6px 14px", fontSize: 13, color: acme.muted, textDecoration: "none", background: "#fff", marginBottom: 24 }}>
            <strong style={{ color: acme.brand }}>New</strong> · {latest.title} · {formatDate(latest.date)} →
          </a>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 60px)", lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 auto 18px", maxWidth: 760 }}>
            Know what your customers actually do.
          </h1>
          <p style={{ fontSize: 19, color: acme.muted, maxWidth: 600, margin: "0 auto 32px", lineHeight: 1.5 }}>
            Acme turns raw product events into dashboards, alerts and answers — for teams that ship every week.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#trial" style={{ background: acme.brand, color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}>Start free trial</a>
            <a href="#demo" style={{ border: `1px solid ${acme.line}`, color: acme.ink, padding: "12px 20px", borderRadius: 10, fontWeight: 600, textDecoration: "none", background: "#fff" }}>Book a demo</a>
          </div>
          <p style={{ marginTop: 28, fontSize: 13, color: acme.muted }}>Trusted by 2,400+ teams at Northwind, Globex, Initech and Umbrella</p>
        </Container>
      </section>
      <Container style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
        {FEATURES.map((f) => (
          <div key={f.title} id="product" style={{ border: `1px solid ${acme.line}`, borderRadius: 14, padding: 24, background: acme.soft }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{f.title}</h3>
            <p style={{ margin: 0, color: acme.muted, lineHeight: 1.55 }}>{f.body}</p>
          </div>
        ))}
      </Container>
    </AcmeShell>
  );
}
