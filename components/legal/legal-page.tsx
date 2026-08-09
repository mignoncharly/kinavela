import Link from "next/link";

import type { Locale } from "@/lib/i18n/config";

export function LegalPage({
  locale,
  kind,
}: {
  locale: Locale;
  kind: "privacy" | "terms";
}) {
  const privacy = kind === "privacy";
  return (
    <main className="legal-page">
      <Link className="brand" href={`/${locale}`}>
        <span className="brand-mark">K</span>KINAVELA
      </Link>
      <p className="eyebrow">LEGAL · VERSION 2026-08-09</p>
      <h1>{privacy ? "Privacy policy" : "Terms of service"}</h1>
      {privacy ? (
        <>
          <p>
            Kinavela is designed for families and applies data minimisation,
            conservative visibility and access control by default. The
            responsible contact is GestionaTech, reachable at
            info@gestionatech.de.
          </p>
          <h2>Data we process</h2>
          <p>
            We process account details, family profile information, approximate
            location preferences, cultural interests, consent records and
            security audit events. We do not request public child accounts or
            exact home addresses.
          </p>
          <h2>Purpose and legal basis</h2>
          <p>
            Data is used to provide the requested family service, secure
            accounts, preserve user choices and meet legal obligations. Optional
            communications require separate consent.
          </p>
          <h2>Storage, access and deletion</h2>
          <p>
            Access is restricted through row-level security. Service providers
            are configured for the European region where available. You may
            request access, correction or deletion through account settings or
            info@gestionatech.de.
          </p>
          <h2>Children</h2>
          <p>
            Children are represented only through guardian-managed private
            profiles. Guardians must provide only information they are
            authorised to process.
          </p>
        </>
      ) : (
        <>
          <p>
            These terms govern use of Kinavela. You must be at least 18 years
            old and authorised to manage any family or child information you
            add.
          </p>
          <h2>Respectful participation</h2>
          <p>
            Harassment, discrimination, impersonation, exploitation, unsafe
            contact with children and unlawful content are prohibited. Family
            privacy and consent boundaries must be respected.
          </p>
          <h2>Your account</h2>
          <p>
            You are responsible for account security and accurate information.
            Kinavela may restrict accounts that threaten users, children,
            security or service integrity.
          </p>
          <h2>Service and liability</h2>
          <p>
            Kinavela provides community infrastructure and does not guarantee
            matches or offline conduct. Users remain responsible for safe
            decisions and compliance with applicable law.
          </p>
        </>
      )}
      <p>
        <strong>Questions:</strong>{" "}
        <a href="mailto:info@gestionatech.de">info@gestionatech.de</a>
      </p>
    </main>
  );
}
