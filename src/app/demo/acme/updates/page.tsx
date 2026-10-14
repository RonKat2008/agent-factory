import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAcmeState, visibleEntries } from "@/lib/demo-acme";
import { AcmeShell, Container, EntryText, acme } from "../_shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "What's new — Acme Analytics" };

export default async function AcmeUpdates() {
  const state = await getAcmeState();
  if (!state.broken) notFound();
  const entries = visibleEntries(state);
  return (
    <AcmeShell state={state}>
      <section style={{ background: `linear-gradient(180deg, ${acme.brandSoft}, #fff)` }}>
        <Container style={{ padding: "72px 20px 40px" }}>
          <p style={{ color: acme.brand, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 13, margin: "0 0 10px" }}>Product updates</p>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "-0.03em", margin: "0 0 10px" }}>What&apos;s new at Acme</h1>
          <p style={{ color: acme.muted, fontSize: 18, margin: 0, maxWidth: 560 }}>Everything we shipped recently, in one place. Subscribe by RSS or email.</p>
        </Container>
      </section>
      <Container style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {entries.map((e) => (
          <div key={e.title} style={{ border: `1px solid ${acme.line}`, borderRadius: 16, padding: 24, background: "#fff", boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.05)" }}>
            <EntryText entry={e} titleSize={18} />
          </div>
        ))}
      </Container>
    </AcmeShell>
  );
}
