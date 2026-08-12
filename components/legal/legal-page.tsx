import Link from "next/link";

import { MetricsConsentSettings } from "@/components/privacy/metrics-consent-settings";
import type { Locale } from "@/lib/i18n/config";

export type LegalKind =
  | "privacy"
  | "terms"
  | "impressum"
  | "cookies"
  | "child-safety"
  | "community-guidelines";

const labels = {
  privacy: "Privacy policy",
  terms: "Terms of service",
  impressum: "Impressum",
  cookies: "Cookie and browser-storage policy",
  "child-safety": "Child safety policy",
  "community-guidelines": "Community guidelines",
} satisfies Record<LegalKind, string>;

function LegalNavigation({ locale }: { locale: Locale }) {
  const links: Array<[LegalKind, string]> = [
    ["privacy", "Privacy"],
    ["terms", "Terms"],
    ["impressum", "Impressum"],
    ["cookies", "Cookies"],
    ["child-safety", "Child safety"],
    ["community-guidelines", "Community guidelines"],
  ];

  return (
    <nav className="legal-navigation" aria-label="Legal documents">
      {links.map(([kind, label]) => (
        <Link href={"/" + locale + "/" + kind} key={kind}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

function DocumentMeta() {
  return (
    <p className="legal-meta">
      Version 1.0 · Effective 11 August 2026 · Last updated 11 August 2026
    </p>
  );
}

function ControllerContact() {
  return (
    <address>
      <strong>Gestiona Tech – Nguenkam Charles</strong>
      <br />
      Einzelunternehmen
      <br />
      Nikolausstraße 6
      <br />
      55120 Mainz, Deutschland
      <br />
      Email: <a href="mailto:info@gestionatech.de">info@gestionatech.de</a>
    </address>
  );
}

function PrivacyDocument() {
  return (
    <>
      <p>
        This Privacy Policy explains how Kinavela processes personal data in the
        family, heritage and community features operated by Gestiona Tech –
        Nguenkam Charles. It applies to the public website, account area,
        onboarding, Roots Passport, Roots Stories, Villages, events, messaging,
        notifications, moderation and privacy requests.
      </p>
      <h2>1. Controller and privacy contact</h2>
      <ControllerContact />
      <p>
        For privacy questions, rights requests or objections, use{" "}
        <a href="mailto:privacy@gestionatech.de">privacy@gestionatech.de</a>.
        This is the privacy contact. No formal Data Protection Officer has been
        appointed; this address must not be understood as a DPO contact.
      </p>
      <h2>2. Data we process</h2>
      <ul>
        <li>
          Account data: email address, authentication identifier, language, time
          zone, display name, verification and account status.
        </li>
        <li>
          Family and discovery data: family name, biography, country and city,
          approximate location chosen through city/postcode search, radius,
          visibility, availability, interests, cultures and languages.
        </li>
        <li>
          Guardian-managed child data: nickname, birth year, optional birth
          month, optional gender, visibility settings and guardian-managed Roots
          Passport content. Kinavela does not create public child accounts and
          does not request an exact date of birth.
        </li>
        <li>
          Content and safety data: messages, stories, voice recordings,
          transcripts, reports, moderation actions, event participation and
          security/audit events.
        </li>
        <li>
          Operations data: consent records, notification preferences and push
          subscription keys when explicitly enabled, first-party product metrics
          after metrics consent, and technical request metadata needed to
          protect the service.
        </li>
      </ul>
      <p>
        Cultural, heritage and language information can reveal sensitive aspects
        of a person&apos;s identity. It is provided voluntarily and is used only
        for the selected family and discovery features. Do not add information
        about another person unless authorised to do so.
      </p>
      <h2>3. Purposes and legal bases</h2>
      <ul>
        <li>
          Account, onboarding, family tools, Roots, messaging and community
          features: performance of the requested contract, Art. 6(1)(b) GDPR.
        </li>
        <li>
          Security, abuse prevention, moderation, incident handling and service
          integrity: legitimate interests, Art. 6(1)(f) GDPR, and legal
          obligations where applicable, Art. 6(1)(c) GDPR.
        </li>
        <li>
          Optional product email: consent, Art. 6(1)(a) GDPR. Consent can be
          withdrawn at any time in Settings.
        </li>
        <li>
          Optional first-party product metrics and related browser storage:
          consent recorded through the privacy settings panel. Declining does
          not reduce access to the service.
        </li>
        <li>
          Tax, accounting and other statutory records: legal obligation, Art.
          6(1)(c) GDPR, only where the relevant transaction or obligation
          exists.
        </li>
      </ul>
      <h2>4. Children and guardians</h2>
      <p>
        Kinavela is an adult-led service. A parent or other authorised guardian
        must enter and manage child information. Child profiles are private by
        default; connection or Village visibility is available only through
        guardian-controlled settings. Do not publish a child&apos;s exact
        address, direct contact details, exact date of birth, school details or
        sensitive media. A guardian may request correction, export or deletion
        through account controls or the privacy contact.
      </p>
      <h2>5. Recipients and processors used in production</h2>
      <p>
        The production application uses the following services, based on the
        deployed code and production configuration at the effective date:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> for authentication, PostgreSQL database,
          private Storage and Realtime. It receives the account, family,
          content, safety and operational data required by the feature. The
          exact project region and contractual transfer mechanism are controlled
          in project administration and are not asserted here from source code
          alone.
        </li>
        <li>
          <strong>Zoho Europe SMTP</strong> at smtp.zoho.eu for account and
          opted-in notification email. It receives the recipient address and
          minimum email content needed for delivery. The endpoint is European;
          no broader EU-only storage claim is made solely from its name.
        </li>
        <li>
          <strong>Nominatim / OpenStreetMap</strong> for explicit server-side
          city or postcode searches during onboarding and discovery. The query
          may include country, city/postcode and UI language. Exact device GPS
          is not used.
        </li>
        <li>
          <strong>Stripe</strong> for hosted Roots Family subscription Checkout,
          customer Portal sessions and signed payment webhooks. Stripe receives
          payment information and billing identifiers needed for the
          subscription; Kinavela does not receive full card data.
        </li>
      </ul>
      <p>
        OpenAI processing, Sentry, third-party analytics, advertising, CAPTCHA
        and Web Push delivery are not enabled in production. Stripe is active
        only for Roots Family billing as described above. If another processor
        is activated, this policy and the consent flow will be updated before
        processing begins.
      </p>
      <h2>6. International transfers</h2>
      <p>
        Transfers may occur when a processor or its infrastructure is outside
        the European Economic Area. We use the safeguards required by applicable
        law, including an adequacy decision, standard contractual clauses or
        another permitted mechanism where required. This policy does not claim
        that all production processing is confined to the EEA.
      </p>
      <h2>7. Retention and deletion</h2>
      <p>
        Data is kept for no longer than needed for its purpose. The automated
        retention job runs through the privacy cron. Account deletion removes
        private media first, deletes child and story content where technically
        possible, anonymises authored messages and leaves only a minimal
        safety/integrity tombstone where a foreign-key or safety need prevents
        immediate physical deletion.
      </p>
      <table>
        <thead>
          <tr>
            <th>Resource</th>
            <th>Actual/retained period</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Account, family, guardian and child data</td>
            <td>While active; deletion workflow on request.</td>
          </tr>
          <tr>
            <td>Private Roots media and story audio/transcripts</td>
            <td>While retained by the family; removed during deletion.</td>
          </tr>
          <tr>
            <td>Personal-data exports</td>
            <td>7 days after ready, then file and row expire.</td>
          </tr>
          <tr>
            <td>Expired or revoked story requests and media</td>
            <td>30 days after expiry or revocation.</td>
          </tr>
          <tr>
            <td>Notification outbox and event reminders</td>
            <td>30 days for delivery records; 90 days for reminders.</td>
          </tr>
          <tr>
            <td>In-app and connection notifications</td>
            <td>365 days.</td>
          </tr>
          <tr>
            <td>First-party product metrics</td>
            <td>180 days; never used for advertising or profiling.</td>
          </tr>
          <tr>
            <td>Security, moderation and audit events</td>
            <td>
              730 days, unless a safety, legal or incident hold requires more.
            </td>
          </tr>
          <tr>
            <td>Backups</td>
            <td>
              Provider-controlled copies follow the configured backup cycle;
              deletion may propagate later and is not represented as immediate
              deletion from immutable copies.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        If a statutory accounting or tax duty applies, the legally required
        record is retained for that duty and access is restricted. Stripe
        billing identifiers and minimized webhook audit metadata are retained
        for subscription authorization, support, accounting and legal
        obligations.
      </p>
      <h2>8. Your rights</h2>
      <p>
        Subject to legal conditions, you may request access, correction,
        deletion, restriction, portability or object to processing. You may
        withdraw consent at any time; withdrawal does not affect processing
        already carried out lawfully. Use Settings where available or contact{" "}
        <a href="mailto:privacy@gestionatech.de">privacy@gestionatech.de</a>.
        You also have the right to complain to the competent supervisory
        authority.
      </p>
      <h2>9. Supervisory authority</h2>
      <p>
        The main supervisory authority for the controller&apos;s seat is the{" "}
        <strong>
          Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit
          Rheinland-Pfalz (LfDI Rheinland-Pfalz)
        </strong>
        : Postfach 30 40, 55020 Mainz; visitor address Hintere Bleiche 34, 55116
        Mainz; telephone +49 (0) 6131 8920-0; email{" "}
        <a href="mailto:poststelle@datenschutz.rlp.de">
          poststelle@datenschutz.rlp.de
        </a>
        ;{" "}
        <a href="https://www.datenschutz.rlp.de/" rel="noreferrer">
          datenschutz.rlp.de
        </a>
        .
      </p>
    </>
  );
}

function TermsDocument() {
  return (
    <>
      <p>
        These Terms govern Kinavela, a privacy-focused family, heritage and
        community service operated by Gestiona Tech – Nguenkam Charles. By
        creating an account or using a feature, you agree to these Terms and the
        linked Privacy Policy and Community Guidelines.
      </p>
      <h2>1. Eligibility and guardian responsibility</h2>
      <p>
        The service is intended for adults. You must be at least 18 years old,
        able to enter a contract and authorised to provide any family or child
        information you submit. You remain responsible for its accuracy and
        lawful use.
      </p>
      <h2>2. Safe and respectful use</h2>
      <p>
        You must follow the Community Guidelines. You must not harass,
        discriminate, threaten, impersonate, dox, scam, groom, exploit or
        sexually approach a child; upload unlawful or abusive content; evade a
        safety restriction; or use Kinavela to obtain private contact or
        location information without consent. A match, profile or event is not a
        safety guarantee.
      </p>
      <h2>3. User content and permissions</h2>
      <p>
        You retain rights in content you submit. You grant Gestiona Tech a
        limited, non-exclusive permission to host, secure, technically process
        and display it only as needed to provide the feature and to the
        audiences you select. You must have the rights and permissions needed
        for every story, recording, image, message or child-related entry.
        Private media is not made public by default.
      </p>
      <h2>4. Moderation and account actions</h2>
      <p>
        We may review reports, limit visibility, remove content, suspend or
        close accounts, or contact authorities when reasonably necessary to
        protect people, children, the service or legal rights. We may preserve a
        minimal safety record for investigation or legal compliance after
        content or an account is removed.
      </p>
      <h2>5. Availability and changes</h2>
      <p>
        Kinavela is an evolving service. Features may be changed, limited or
        discontinued for security, maintenance, legal or operational reasons. We
        do not promise uninterrupted availability, a particular match, an event
        outcome, an AI result or the conduct of another user.
      </p>
      <h2>6. Paid features</h2>
      <p>
        Roots Family subscriptions are billed monthly at €5.99 or annually at
        €59.99. The annual plan is a yearly recurring charge and is displayed as
        saving 16 percent compared with twelve monthly payments. Subscriptions
        renew automatically until canceled through the Stripe Customer Portal.
        Cancel-at-period-end access remains available through the paid period.
        Stripe processes payment information and Kinavela does not receive full
        card data. Mandatory consumer withdrawal, refund, statutory warranty and
        other consumer rights remain unaffected.
      </p>
      <h2>7. Liability</h2>
      <p>
        Nothing in these Terms limits liability that cannot legally be limited,
        including liability for intent, gross negligence, injury to life, body
        or health, or mandatory consumer protections. Subject to that, liability
        is limited to the legally permissible extent, especially for events,
        user interactions, user content, outages and indirect loss not caused by
        a breach of an essential contractual obligation.
      </p>
      <h2>8. Governing law and venue</h2>
      <p>
        German law applies, subject to mandatory consumer-protection provisions
        in the country of your habitual residence. The registered seat of
        Gestiona Tech in Mainz is a competent venue only where legally
        permitted; these Terms do not impose Mainz as an exclusive venue on
        consumers.
      </p>
      <h2>9. Contact</h2>
      <p>
        Questions, notices and safety reports can be sent to{" "}
        <a href="mailto:info@gestionatech.de">info@gestionatech.de</a>.
      </p>
    </>
  );
}

function ImpressumDocument() {
  return (
    <>
      <h2>Provider</h2>
      <ControllerContact />
      <p>
        Legal form: Einzelunternehmen. Owner and responsible representative:
        Nguenkam Charles.
      </p>
      <p>
        Handelsregister: Nicht eingetragen. Wirtschafts-Identifikationsnummer:
        DE455342848. No USt-IdNr. / VAT ID has been provided and none is
        published here. The tax number is not published.
      </p>
      <h2>Contact</h2>
      <p>
        General contact:{" "}
        <a href="mailto:info@gestionatech.de">info@gestionatech.de</a>. For
        privacy matters:{" "}
        <a href="mailto:privacy@gestionatech.de">privacy@gestionatech.de</a>. No
        formal DPO has been designated.
      </p>
      <h2>Consumer dispute resolution</h2>
      <p>
        The European Online Dispute Resolution platform has been discontinued.
        We are not obliged and, unless legally required otherwise, do not
        undertake to participate in dispute-resolution proceedings before a
        consumer arbitration board.
      </p>
      <h2>Responsible content</h2>
      <p>
        Responsible provider for the content of this website is Nguenkam Charles
        at the address above. External links are checked when created; the
        content of linked third-party pages remains the responsibility of their
        operators.
      </p>
    </>
  );
}

function CookieDocument({ locale }: { locale: Locale }) {
  return (
    <>
      <p>
        Kinavela currently uses no advertising, social-media, third-party
        analytics or marketing cookie. The following first-party cookies and
        browser storage are used by the deployed application.
      </p>
      <table>
        <thead>
          <tr>
            <th>Name / technology</th>
            <th>Purpose</th>
            <th>Duration</th>
            <th>Consent</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Supabase Auth cookie family{" "}
              <code>sb-lchpxzbjawqpirqlhqlh-auth-token</code> (chunk suffixes
              may be used)
            </td>
            <td>Authentication and session continuity.</td>
            <td>Until logout or Supabase Auth session/refresh expiry.</td>
            <td>Strictly necessary.</td>
          </tr>
          <tr>
            <td>
              <code>kinavela:metrics-consent</code> in localStorage
            </td>
            <td>Stores the choice to enable first-party product metrics.</td>
            <td>Until the visitor changes or clears the choice.</td>
            <td>Consent memory; metrics require opt-in.</td>
          </tr>
          <tr>
            <td>
              <code>kinavela:app_session_started</code> in sessionStorage
            </td>
            <td>Prevents duplicate opt-in session metric events.</td>
            <td>Until the browser tab/session ends.</td>
            <td>Only written after metrics consent.</td>
          </tr>
          <tr>
            <td>
              IndexedDB database <code>kinavela-offline-v1</code>
            </td>
            <td>Optional user-selected offline Passport/Missions snapshots.</td>
            <td>30 days without refresh, or until cleared by the user.</td>
            <td>Feature action by the user; no banner needed.</td>
          </tr>
          <tr>
            <td>
              Cache Storage <code>kinavela-shell-v1</code> and service worker
            </td>
            <td>Offline shell and static assets; no account content.</td>
            <td>Until service-worker update, uninstall or browser clear.</td>
            <td>Strictly necessary for the enabled PWA shell.</td>
          </tr>
        </tbody>
      </table>
      <p>
        The current production Web Push public key is empty, so push
        subscription storage and delivery are not enabled. Kinavela does not
        embed a payment widget or store payment details in browser storage;
        Stripe-hosted Checkout and Portal pages open on Stripe infrastructure.
        The privacy settings panel lets you change the metrics choice; the
        service remains usable when metrics are declined.
      </p>
      <p>
        To change the optional metrics choice, use the control below or clear
        site data in your browser.
      </p>
      <MetricsConsentSettings locale={locale} />
    </>
  );
}

function ChildSafetyDocument() {
  return (
    <>
      <p>
        Kinavela is an adult-led family service. Child safety takes priority
        over engagement, growth and preserving content. Children do not have
        public accounts; guardian-managed child profiles are private by default.
      </p>
      <h2>Prohibited conduct</h2>
      <ul>
        <li>
          sexual content involving a child, grooming or sexual solicitation;
        </li>
        <li>
          requests for a child&apos;s private contact details, school or exact
          location;
        </li>
        <li>
          exploitation, trafficking, coercion, threats or credible danger;
        </li>
        <li>
          sharing intimate, humiliating or identifying child imagery without
          lawful authority;
        </li>
        <li>attempts to bypass guardian visibility, blocks or moderation.</li>
      </ul>
      <h2>Reporting</h2>
      <p>
        Report suspected child-safety, security or abuse issues through the
        in-product report flow where available or email{" "}
        <a href="mailto:info@gestionatech.de">info@gestionatech.de</a> with
        subject “Urgent child safety” or “Security report”. Do not attach
        illegal child sexual-abuse material or redistribute it. Provide only the
        minimum information needed to identify the account or content. There is
        no separate safety address at this time.
      </p>
      <h2>Handling and escalation</h2>
      <p>
        Reports are triaged as soon as reasonably practicable; no guaranteed
        response-time SLA is promised. Urgent reports are prioritised, content
        may be restricted while reviewed, and a minimal evidence record may be
        preserved for safety or legal reasons. For immediate danger, contact
        emergency services and the child-protection or law-enforcement authority
        in the country where the danger occurs. For cross-border matters,
        escalation may involve competent authorities in Germany and in the
        relevant country of the child or incident. Kinavela is not an emergency
        service.
      </p>
      <h2>Guardian controls</h2>
      <p>
        Guardians control child visibility and may request access, correction or
        deletion through Settings or{" "}
        <a href="mailto:privacy@gestionatech.de">privacy@gestionatech.de</a>.
        Child content and private media are deleted or restricted as part of an
        account-deletion workflow, subject to safety and legal holds.
      </p>
    </>
  );
}

function CommunityGuidelinesDocument() {
  return (
    <>
      <p>
        Kinavela is a shared space for family heritage and trusted community.
        Participate with care, cultural humility and respect for each
        family&apos;s boundaries.
      </p>
      <h2>Do</h2>
      <ul>
        <li>
          ask before sharing another person&apos;s story, image or contact
          details;
        </li>
        <li>use accurate, non-invasive profile information;</li>
        <li>
          respect language, culture, disability, religion, identity and family
          choices;
        </li>
        <li>
          keep children&apos;s information guardian-controlled and minimal;
        </li>
        <li>
          use blocks and reports when a connection or conversation feels unsafe.
        </li>
      </ul>
      <h2>Do not</h2>
      <ul>
        <li>harass, threaten, discriminate, stalk, dox or impersonate;</li>
        <li>
          spam, defraud, solicit money or pressure someone to meet offline;
        </li>
        <li>
          publish exact addresses, private contact details or another
          family&apos;s data;
        </li>
        <li>upload unlawful, hateful, exploitative or sexual child content;</li>
        <li>
          circumvent moderation, account restrictions or another person&apos;s
          block.
        </li>
      </ul>
      <h2>Reports and moderation</h2>
      <p>
        Use the in-product report flow for family, message, Village and event
        concerns. Safety and child-protection reports may also be sent to{" "}
        <a href="mailto:info@gestionatech.de">info@gestionatech.de</a>.
        Moderators may limit visibility, remove content, preserve a minimal
        safety record and suspend accounts. We aim to act consistently with the
        seriousness and credibility of the report; no guaranteed moderation SLA
        is promised.
      </p>
      <h2>Appeals and mistakes</h2>
      <p>
        If you believe an action was mistaken, contact{" "}
        <a href="mailto:info@gestionatech.de">info@gestionatech.de</a> with the
        relevant account and action. Do not republish removed content while an
        appeal is pending.
      </p>
    </>
  );
}

export function LegalPage({
  locale,
  kind,
}: {
  locale: Locale;
  kind: LegalKind;
}) {
  const document =
    kind === "privacy" ? (
      <PrivacyDocument />
    ) : kind === "terms" ? (
      <TermsDocument />
    ) : kind === "impressum" ? (
      <ImpressumDocument />
    ) : kind === "cookies" ? (
      <CookieDocument locale={locale} />
    ) : kind === "child-safety" ? (
      <ChildSafetyDocument />
    ) : (
      <CommunityGuidelinesDocument />
    );

  return (
    <main className="legal-page">
      <Link className="brand" href={"/" + locale}>
        <span className="brand-mark">K</span>KINAVELA
      </Link>
      <p className="eyebrow">LEGAL · KINAVELA</p>
      <h1>{labels[kind]}</h1>
      <DocumentMeta />
      {document}
      <LegalNavigation locale={locale} />
      <p>
        <strong>General contact:</strong>{" "}
        <a href="mailto:info@gestionatech.de">info@gestionatech.de</a>
      </p>
    </main>
  );
}
