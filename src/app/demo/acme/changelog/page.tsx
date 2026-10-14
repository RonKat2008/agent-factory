import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAcmeState, visibleEntries } from "@/lib/demo-acme";
import { AcmeShell, Container, EntryText, acme } from "../_shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Changelog — Acme Analytics" };

export default async function AcmeChangelog() {
  const state = await getAcmeState();
  if (state.broken) notFound();
  const entries = visibleEntries(state);
  return (
    <AcmeShell state={state}>
      <Container style={{ maxWidth: 760, padding: "64px 20px 0" }}>
        <h1 style={{ fontSize: 40, letterSpacing: "-0.02em", margin: "0 0 8px" }}>Changelog</h1>
        <p style={{ color: acme.muted, margin: "0 0 40px", fontSize: 17 }}>New features, improvements and fixes in Acme Analytics.</p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {entries.map((e) => (
            <li key={e.title} style={{ borderLeft: `2px solid ${acme.line}`, padding: "0 0 36px 24px", position: "relative" }}>
              <span style={{ position: "absolute", left: -6, top: 4, width: 10, height: 10, borderRadius: 999, background: acme.brand }} />
              <EntryText entry={e} />
            </li>
          ))}
        </ul>
      </Container>
    </AcmeShell>
  );
}
