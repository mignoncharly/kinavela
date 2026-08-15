import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

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
import "./phase29-family-settings.css";
import "./phase32-invitations.css";
import "./phase33-discovery-activation.css";
import "./phase34-trust-safety.css";
import "./phase35-support.css";
import "./phase36-offline-coordination.css";
import "./phase37-blog.css";
import "./pwa.css";
import "./responsive.css";

import { isLocale } from "@/lib/i18n/config";
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
  // Without max-snippet/max-image-preview, Google caps how much of a page it
  // may quote, which also limits what AI surfaces can summarise or cite.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: { type: "website", siteName: "Kinavela" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f8f3ea",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestedLocale = (await headers()).get("x-kinavela-locale") ?? "de";
  const locale = isLocale(requestedLocale) ? requestedLocale : "de";
  return (
    <html lang={locale} suppressHydrationWarning>
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
