import type { Metadata, Viewport } from "next";

import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import "./phase12.css";
import "./phase8-events.css";
import "./phase9-village-discovery.css";
import "./phase10-missions.css";
import "./phase11-roots.css";
import "./phase12-stories.css";
import "./phase15-notifications.css";
import "./phase16-admin.css";
import "./phase17-billing.css";
import "./phase18-seo.css";
import "./phase19-privacy.css";
import "./phase21-pilot.css";
import "./pwa.css";
import "./responsive.css";

import { DocumentLanguage } from "@/components/i18n/document-language";
import { MetricsConsentBanner } from "@/components/privacy/metrics-consent-banner";
import { PwaRuntime } from "@/components/pwa/pwa-runtime";
import { ProductEventTracker } from "@/components/metrics/product-event-tracker";

export const dynamic = "force-dynamic";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.kinavela.com"),
  applicationName: "Kinavela",
  title: { default: "Kinavela", template: "%s · Kinavela" },
  description:
    "Privacy-first cultural community infrastructure for diaspora families.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f8f3ea",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className={geistSans.variable + " " + geistMono.variable}>
        {children}
        <DocumentLanguage />
        <MetricsConsentBanner />
        <PwaRuntime />
        <ProductEventTracker event="app_session_started" />
      </body>
    </html>
  );
}
