import type { Metadata } from "next";

import { OfflineDashboard } from "@/components/pwa/offline-data";

export const metadata: Metadata = { title: "Offline space" };

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-hero">
        <p className="eyebrow">KINAVELA OFFLINE</p>
        <h1>Your family space, close at hand.</h1>
        <p>
          Only snapshots you deliberately saved on this device appear here. New
          changes require a connection.
        </p>
        <OfflineDashboard />
      </section>
    </main>
  );
}
