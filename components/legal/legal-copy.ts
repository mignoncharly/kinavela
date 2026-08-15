import type { Locale } from "@/lib/i18n/config";
import type { LegalKind } from "./legal-page";

type Section = {
  title?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
};

type Document = { intro?: string; sections: Section[] };

export type LegalCopy = {
  labels: Record<LegalKind, string>;
  navigationLabel: string;
  eyebrow: string;
  meta: string;
  generalContact: string;
  controller: { email: string; legalForm: string };
  documents: Record<LegalKind, Document>;
};

const retentionRows = {
  de: [
    [
      "Konto-, Familien-, Sorgeberechtigten- und Kinderdaten",
      "Während der aktiven Nutzung; Löschverfahren auf Anfrage.",
    ],
    [
      "Private Roots-Medien sowie Story-Audio und -Transkripte",
      "Solange die Familie sie aufbewahrt; Entfernung im Löschverfahren.",
    ],
    [
      "Export personenbezogener Daten",
      "7 Tage nach Bereitstellung; danach verfallen Datei und Datensatz.",
    ],
    [
      "Abgelaufene oder widerrufene Story-Anfragen und Medien",
      "30 Tage nach Ablauf oder Widerruf.",
    ],
    [
      "Benachrichtigungs-Postausgang und Event-Erinnerungen",
      "30 Tage für Zustellnachweise; 90 Tage für Erinnerungen.",
    ],
    ["In-App- und Verbindungsbenachrichtigungen", "365 Tage."],
    ["Eigene Produktmetriken", "180 Tage; niemals für Werbung oder Profiling."],
    ["Technische Sentry-Fehler- und Leistungsereignisse", "30 Tage."],
    [
      "Sicherheits-, Moderations- und Audit-Ereignisse",
      "730 Tage, sofern keine Sicherheits-, Rechts- oder Incident-Aufbewahrung mehr verlangt.",
    ],
    [
      "Sicherungen",
      "Vom Anbieter gesteuerte Kopien folgen dem eingerichteten Sicherungszyklus; die Löschung kann sich später fortpflanzen.",
    ],
  ],
  fr: [
    [
      "Données de compte, de famille, de responsable et d’enfant",
      "Pendant l’utilisation active ; procédure de suppression sur demande.",
    ],
    [
      "Médias Roots privés, audio et transcriptions de récits",
      "Tant que la famille les conserve ; suppression lors de l’effacement.",
    ],
    [
      "Exports de données personnelles",
      "7 jours après disponibilité ; le fichier et l’enregistrement expirent ensuite.",
    ],
    [
      "Demandes de récit et médias expirés ou révoqués",
      "30 jours après l’expiration ou la révocation.",
    ],
    [
      "Boîte d’envoi des notifications et rappels d’événements",
      "30 jours pour les preuves de livraison ; 90 jours pour les rappels.",
    ],
    ["Notifications dans l’application et de connexion", "365 jours."],
    [
      "Métriques produit internes",
      "180 jours ; jamais utilisées pour la publicité ni le profilage.",
    ],
    ["Événements techniques d’erreur et de performance Sentry", "30 jours."],
    [
      "Événements de sécurité, de modération et d’audit",
      "730 jours, sauf obligation de conservation liée à la sécurité, au droit ou à un incident.",
    ],
    [
      "Sauvegardes",
      "Les copies gérées par le prestataire suivent le cycle configuré ; la suppression peut se propager ultérieurement.",
    ],
  ],
  en: [
    [
      "Account, family, guardian and child data",
      "While active; deletion workflow on request.",
    ],
    [
      "Private Roots media and story audio/transcripts",
      "While retained by the family; removed during deletion.",
    ],
    ["Personal-data exports", "7 days after ready, then file and row expire."],
    [
      "Expired or revoked story requests and media",
      "30 days after expiry or revocation.",
    ],
    [
      "Notification outbox and event reminders",
      "30 days for delivery records; 90 days for reminders.",
    ],
    ["In-app and connection notifications", "365 days."],
    [
      "First-party product metrics",
      "180 days; never used for advertising or profiling.",
    ],
    ["Technical Sentry error and performance events", "30 days."],
    [
      "Security, moderation and audit events",
      "730 days unless a safety, legal or incident hold requires more.",
    ],
    [
      "Backups",
      "Provider-controlled copies follow the configured backup cycle; deletion may propagate later.",
    ],
  ],
} satisfies Record<Locale, string[][]>;

export const legalCopy: Record<Locale, LegalCopy> = {
  de: {
    labels: {
      privacy: "Datenschutzerklärung",
      terms: "Nutzungsbedingungen",
      impressum: "Impressum",
      cookies: "Cookie- und Browser-Speicher-Richtlinie",
      "child-safety": "Kinderschutzrichtlinie",
      "community-guidelines": "Community-Regeln",
    },
    navigationLabel: "Rechtliche Dokumente",
    eyebrow: "RECHTLICHES · KINAVELA",
    meta: "Version 1.2 · Gültig ab 11. August 2026 · Zuletzt aktualisiert am 15. August 2026",
    generalContact: "Allgemeiner Kontakt:",
    controller: { email: "E-Mail", legalForm: "Einzelunternehmen" },
    documents: {
      privacy: {
        intro:
          "Diese Datenschutzerklärung erläutert, wie Kinavela personenbezogene Daten in den von Gestiona Tech – Nguenkam Charles betriebenen Familien-, Herkunfts- und Community-Funktionen verarbeitet. Sie gilt für die öffentliche Website, den Kontobereich, das Onboarding, Roots Passport, Roots Stories, Villages, Events, Nachrichten, Benachrichtigungen, Moderation und Datenschutzanfragen.",
        sections: [
          {
            title: "1. Verantwortlicher und Datenschutzkontakt",
            paragraphs: [
              "Bei Fragen zum Datenschutz, zur Ausübung Ihrer Rechte oder bei Widersprüchen kontaktieren Sie {{privacy}}. Diese Adresse ist der Datenschutzkontakt. Ein formeller Datenschutzbeauftragter wurde nicht bestellt; die Adresse ist nicht als DSB-Kontakt zu verstehen.",
            ],
          },
          {
            title: "2. Verarbeitete Daten",
            bullets: [
              "Kontodaten: E-Mail-Adresse, Authentifizierungskennung, Sprache, Zeitzone, Anzeigename, Verifizierungs- und Kontostatus.",
              "Familien- und Entdeckungsdaten: Familienname, Biografie, Land und Stadt, über Stadt-/Postleitzahlensuche gewählter ungefährer Standort, Radius, Sichtbarkeit, Verfügbarkeit, Interessen, Kulturen und Sprachen.",
              "Von Sorgeberechtigten verwaltete Kinderdaten: Spitzname, Geburtsjahr, optionaler Geburtsmonat, optionales Geschlecht, Sichtbarkeitseinstellungen und privat verwaltete Roots-Passport-Inhalte. Kinavela erstellt keine öffentlichen Kinderkonten und fragt kein genaues Geburtsdatum ab.",
              "Inhalts- und Sicherheitsdaten: Nachrichten, Stories, Sprachaufnahmen, Transkripte, Meldungen, Moderationsmaßnahmen, Eventteilnahme sowie Sicherheits-/Auditereignisse.",
              "Betriebsdaten: Einwilligungen, Benachrichtigungseinstellungen und bei ausdrücklicher Aktivierung Push-Schlüssel, eigene Produktmetriken nach Einwilligung sowie technische Anfragemetadaten zum Schutz des Dienstes.",
            ],
            paragraphs: [
              "Kultur-, Herkunfts- und Sprachangaben können sensible Aspekte der Identität offenbaren. Sie werden freiwillig bereitgestellt und nur für die gewählten Familien- und Entdeckungsfunktionen verwendet. Tragen Sie Daten anderer Personen nur ein, wenn Sie dazu berechtigt sind.",
            ],
          },
          {
            title: "3. Zwecke und Rechtsgrundlagen",
            bullets: [
              "Konto, Onboarding, Familienwerkzeuge, Roots, Nachrichten und Community-Funktionen: Erfüllung des angefragten Vertrags, Art. 6 Abs. 1 lit. b DSGVO.",
              "Sicherheit, Missbrauchsprävention, Moderation, Incident-Bearbeitung und Dienstintegrität: berechtigte Interessen, Art. 6 Abs. 1 lit. f DSGVO, sowie gegebenenfalls rechtliche Pflichten, Art. 6 Abs. 1 lit. c DSGVO.",
              "Optionale Produkt-E-Mails: Einwilligung, Art. 6 Abs. 1 lit. a DSGVO; jederzeit in den Einstellungen widerrufbar.",
              "Optionale eigene Produktmetriken und zugehöriger Browserspeicher: über die Datenschutzeinstellungen erfasste Einwilligung. Eine Ablehnung beschränkt den Dienst nicht.",
              "Steuer-, Buchhaltungs- und sonstige gesetzliche Unterlagen: rechtliche Pflicht, Art. 6 Abs. 1 lit. c DSGVO, soweit die jeweilige Pflicht besteht.",
            ],
          },
          {
            title: "4. Kinder und Sorgeberechtigte",
            paragraphs: [
              "Kinavela ist ein von Erwachsenen geführter Dienst. Eltern oder andere berechtigte Sorgeberechtigte müssen Kinderdaten eingeben und verwalten. Kinderprofile sind standardmäßig privat; Sichtbarkeit für Verbindungen oder Villages ist nur über von Sorgeberechtigten gesteuerte Einstellungen möglich. Veröffentlichen Sie keine genaue Adresse, direkten Kontaktdaten, genaues Geburtsdatum, Schulangaben oder sensible Medien eines Kindes. Über Kontosteuerungen oder {{privacy}} können Sorgeberechtigte Berichtigung, Export oder Löschung verlangen.",
            ],
          },
          {
            title:
              "5. Empfänger und in der Produktion eingesetzte Auftragsverarbeiter",
            bullets: [
              "Supabase für Authentifizierung, PostgreSQL-Datenbank, privaten Storage und Realtime. Es erhält die für die jeweilige Funktion erforderlichen Konto-, Familien-, Inhalts-, Sicherheits- und Betriebsdaten.",
              "Zoho Europe SMTP unter smtp.zoho.eu für Konto- und ausdrücklich erlaubte Benachrichtigungs-E-Mails. Es erhält Empfängeradresse und den für die Zustellung erforderlichen Mindestinhalt.",
              "Nominatim / OpenStreetMap für ausdrücklich serverseitig ausgeführte Stadt- oder Postleitzahlensuchen bei Onboarding und Entdeckung. Die Suchanfrage kann Land, Stadt/Postleitzahl und UI-Sprache enthalten; exaktes Geräte-GPS wird nicht verwendet.",
              "Stripe für gehostetes Roots-Family-Abonnement-Checkout, Kundenportal-Sitzungen und signierte Zahlungs-Webhooks. Stripe erhält die für das Abonnement nötigen Zahlungsinformationen und Abrechnungskennungen; Kinavela erhält keine vollständigen Kartendaten.",
              "Sentry (deutsche Region) für technische Fehler- und Leistungsüberwachung. Übermittelt werden minimierte Fehler- und Stacktrace-Daten, Routenmuster, Laufzeit-, Browser- und Geräteangaben sowie eine Stichprobe von Leistungsdaten. Während der Netzwerkzustellung kann die technische IP-Adresse verarbeitet werden. Standardmäßige personenbezogene Daten, Session Replay, Formulare, Anfrageinhalte, Nachrichten, Stories, Transkripte und Kinderdaten sind deaktiviert oder werden vor der Übermittlung gefiltert.",
            ],
            paragraphs: [
              "OpenAI-Verarbeitung, Drittanbieter-Analytics, Werbung, CAPTCHA und Web-Push-Zustellung sind in der Produktion nicht aktiviert. Stripe ist nur für die oben beschriebene Roots-Family-Abrechnung aktiv. Vor Aktivierung weiterer Auftragsverarbeiter werden diese Erklärung und der Einwilligungsablauf aktualisiert.",
            ],
          },
          {
            title: "6. Internationale Datenübermittlungen",
            paragraphs: [
              "Übermittlungen können stattfinden, wenn ein Auftragsverarbeiter oder seine Infrastruktur außerhalb des Europäischen Wirtschaftsraums liegt. Wir verwenden die nach anwendbarem Recht erforderlichen Garantien, einschließlich Angemessenheitsbeschluss, Standardvertragsklauseln oder eines anderen zulässigen Mechanismus. Diese Erklärung behauptet nicht, dass jede Produktionsverarbeitung auf den EWR beschränkt ist.",
            ],
          },
          {
            title: "7. Aufbewahrung und Löschung",
            paragraphs: [
              "Daten werden nicht länger als für ihren Zweck erforderlich aufbewahrt. Der automatisierte Aufbewahrungsjob läuft über den Datenschutz-Cron. Bei einer Kontolöschung werden zuerst private Medien entfernt, Kind- und Story-Inhalte soweit technisch möglich gelöscht, verfasste Nachrichten anonymisiert und nur ein minimaler Sicherheits-/Integritätsmarker belassen, wenn Fremdschlüssel- oder Sicherheitsgründe eine sofortige physische Löschung verhindern.",
            ],
            table: {
              headers: ["Ressource", "Tatsächliche/Aufbewahrungsdauer"],
              rows: retentionRows.de,
            },
          },
          {
            paragraphs: [
              "Soweit eine gesetzliche Buchhaltungs- oder Steuerpflicht besteht, wird der notwendige Datensatz hierfür mit eingeschränktem Zugriff aufbewahrt. Stripe-Abrechnungskennungen und minimierte Webhook-Auditmetadaten bleiben für Abonnementautorisierung, Support, Buchhaltung und rechtliche Pflichten erhalten.",
            ],
          },
          {
            title: "8. Ihre Rechte",
            paragraphs: [
              "Vorbehaltlich der gesetzlichen Voraussetzungen können Sie Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit verlangen oder der Verarbeitung widersprechen. Sie können Einwilligungen jederzeit widerrufen; dies berührt die Rechtmäßigkeit der zuvor erfolgten Verarbeitung nicht. Nutzen Sie, soweit verfügbar, die Einstellungen oder kontaktieren Sie {{privacy}}. Außerdem haben Sie das Recht, sich bei der zuständigen Aufsichtsbehörde zu beschweren.",
            ],
          },
          {
            title: "9. Aufsichtsbehörde",
            paragraphs: [
              "Die für den Sitz des Verantwortlichen zuständige Aufsichtsbehörde ist Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz (LfDI Rheinland-Pfalz), Postfach 30 40, 55020 Mainz; Besucheranschrift Hintere Bleiche 34, 55116 Mainz; Telefon +49 (0) 6131 8920-0; E-Mail {{authority}}; datenschutz.rlp.de.",
            ],
          },
        ],
      },
      terms: {
        intro:
          "Diese Bedingungen regeln Kinavela, einen datenschutzorientierten Dienst für Familien, Herkunft und Community von Gestiona Tech – Nguenkam Charles. Mit der Kontoerstellung oder Nutzung einer Funktion stimmen Sie diesen Bedingungen sowie der verlinkten Datenschutzerklärung und den Community-Regeln zu.",
        sections: [
          {
            title:
              "1. Teilnahmeberechtigung und Verantwortung von Sorgeberechtigten",
            paragraphs: [
              "Der Dienst richtet sich an Erwachsene. Sie müssen mindestens 18 Jahre alt, geschäftsfähig und berechtigt sein, alle übermittelten Familien- oder Kinderdaten anzugeben. Sie bleiben für deren Richtigkeit und rechtmäßige Nutzung verantwortlich.",
            ],
          },
          {
            title: "2. Sichere und respektvolle Nutzung",
            paragraphs: [
              "Sie müssen die Community-Regeln befolgen. Sie dürfen weder belästigen, diskriminieren, bedrohen, sich ausgeben als andere Person, doxxen, betrügen, grooming betreiben, ein Kind ausbeuten oder sexuell ansprechen, rechtswidrige oder missbräuchliche Inhalte hochladen, Sicherheitsbeschränkungen umgehen oder ohne Einwilligung private Kontakt- oder Standortdaten beschaffen. Ein Match, Profil oder Event ist keine Sicherheitsgarantie.",
            ],
          },
          {
            title: "3. Nutzungsinhalte und Berechtigungen",
            paragraphs: [
              "Sie behalten die Rechte an Ihren eingereichten Inhalten. Sie erteilen Gestiona Tech eine beschränkte, nicht ausschließliche Erlaubnis, diese nur soweit zu hosten, zu sichern, technisch zu verarbeiten und den von Ihnen gewählten Zielgruppen anzuzeigen, wie dies für die Funktion erforderlich ist. Für jede Story, Aufnahme, jedes Bild, jede Nachricht oder jeden kindbezogenen Eintrag müssen Sie die erforderlichen Rechte und Einwilligungen besitzen. Private Medien werden nicht standardmäßig veröffentlicht.",
            ],
          },
          {
            title: "4. Moderation und Kontomaßnahmen",
            paragraphs: [
              "Wir dürfen Meldungen prüfen, Sichtbarkeit einschränken, Inhalte entfernen, Konten sperren oder schließen oder Behörden kontaktieren, wenn dies zum Schutz von Personen, Kindern, dem Dienst oder Rechtspositionen angemessen erforderlich ist. Nach Entfernung von Inhalt oder Konto können wir für Untersuchung oder Rechtskonformität einen minimalen Sicherheitsdatensatz aufbewahren.",
            ],
          },
          {
            title: "5. Verfügbarkeit und Änderungen",
            paragraphs: [
              "Kinavela ist ein sich weiterentwickelnder Dienst. Funktionen können aus Sicherheits-, Wartungs-, rechtlichen oder betrieblichen Gründen geändert, eingeschränkt oder eingestellt werden. Wir versprechen keine unterbrechungsfreie Verfügbarkeit, kein bestimmtes Match- oder Eventergebnis, kein KI-Ergebnis und kein Verhalten anderer Nutzender.",
            ],
          },
          {
            title: "6. Kostenpflichtige Funktionen",
            paragraphs: [
              "Roots-Family-Abonnements werden monatlich mit 5,99 € oder jährlich mit 59,99 € abgerechnet. Der Jahresplan ist eine jährlich wiederkehrende Zahlung und wird mit einer Ersparnis von 16 Prozent gegenüber zwölf Monatszahlungen dargestellt. Abonnements verlängern sich automatisch, bis sie über das Stripe-Kundenportal gekündigt werden. Bei Kündigung zum Periodenende bleibt der Zugang bis zum Ende des bezahlten Zeitraums bestehen. Stripe verarbeitet Zahlungsinformationen; Kinavela erhält keine vollständigen Kartendaten. Zwingende Widerrufs-, Erstattungs-, Gewährleistungs- und sonstige Verbraucherrechte bleiben unberührt.",
            ],
          },
          {
            title: "7. Haftung",
            paragraphs: [
              "Nichts in diesen Bedingungen beschränkt eine Haftung, die rechtlich nicht beschränkt werden kann, insbesondere nicht bei Vorsatz, grober Fahrlässigkeit, Verletzung von Leben, Körper oder Gesundheit oder bei zwingendem Verbraucherschutz. Im Übrigen ist die Haftung im gesetzlich zulässigen Umfang beschränkt, insbesondere bei Events, Interaktionen und Inhalten von Nutzenden, Ausfällen und mittelbaren Schäden ohne Verletzung einer wesentlichen Vertragspflicht.",
            ],
          },
          {
            title: "8. Anwendbares Recht und Gerichtsstand",
            paragraphs: [
              "Es gilt deutsches Recht, vorbehaltlich zwingender Verbraucherschutzvorschriften des Landes Ihres gewöhnlichen Aufenthalts. Der Sitz von Gestiona Tech in Mainz ist nur soweit gesetzlich zulässig ein zuständiger Gerichtsstand; diese Bedingungen bestimmen Mainz nicht als ausschließlichen Gerichtsstand für Verbrauchende.",
            ],
          },
          {
            title: "9. Kontakt",
            paragraphs: [
              "Fragen, Mitteilungen und Sicherheitsmeldungen können an {{info}} gesendet werden.",
            ],
          },
        ],
      },
      impressum: {
        sections: [
          {
            title: "Anbieter",
            paragraphs: [
              "Rechtsform: Einzelunternehmen. Inhaber und verantwortlicher Vertreter: Nguenkam Charles.",
              "Handelsregister: Nicht eingetragen. Wirtschafts-Identifikationsnummer: DE455342848. Es wurde keine USt-IdNr. angegeben; sie wird hier nicht erfunden oder veröffentlicht. Die Steuernummer wird nicht veröffentlicht.",
            ],
          },
          {
            title: "Kontakt",
            paragraphs: [
              "Allgemeiner Kontakt: {{info}}. Datenschutzangelegenheiten: {{privacy}}. Ein formeller Datenschutzbeauftragter wurde nicht bestellt.",
            ],
          },
          {
            title: "Verbraucherstreitbeilegung",
            paragraphs: [
              "Die europäische Plattform zur Online-Streitbeilegung wurde eingestellt. Wir sind nicht verpflichtet und, soweit nicht rechtlich anders erforderlich, nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
            ],
          },
          {
            title: "Verantwortliche Inhalte",
            paragraphs: [
              "Verantwortlicher Anbieter für die Inhalte dieser Website ist Nguenkam Charles unter der oben genannten Anschrift. Externe Links werden bei ihrer Erstellung geprüft; für die Inhalte verlinkter Seiten Dritter bleiben deren Betreiber verantwortlich.",
            ],
          },
        ],
      },
      cookies: {
        intro:
          "Kinavela verwendet derzeit keine Cookies für Werbung, soziale Medien, Marketing oder Drittanbieter-Analytics. Die folgende Tabelle beschreibt die von der bereitgestellten Anwendung verwendeten First-Party-Cookies und Browser-Speicher.",
        sections: [
          {
            table: {
              headers: ["Name / Technologie", "Zweck", "Dauer", "Einwilligung"],
              rows: [
                [
                  "Supabase-Auth-Cookie-Familie sb-lchpxzbjawqpirqlhqlh-auth-token (Chunk-Suffixe möglich)",
                  "Authentifizierung und Sitzungsfortsetzung.",
                  "Bis zur Abmeldung oder zum Ablauf der Supabase-Auth-Sitzung/Aktualisierung.",
                  "Streng erforderlich.",
                ],
                [
                  "kinavela:metrics-consent in localStorage",
                  "Speichert die Wahl für eigene Produktmetriken.",
                  "Bis Besuchende die Wahl ändern oder löschen.",
                  "Speichert die Einwilligung; Metriken erfordern Opt-in.",
                ],
                [
                  "kinavela:app_session_started in sessionStorage",
                  "Verhindert doppelte Sitzungsmetriken nach Opt-in.",
                  "Bis Browser-Tab oder Sitzung endet.",
                  "Nur nach Metrik-Einwilligung geschrieben.",
                ],
                [
                  "IndexedDB-Datenbank kinavela-offline-v1",
                  "Optionale, von Nutzenden ausgewählte Offline-Snapshots von Passport und Missionen.",
                  "30 Tage ohne Aktualisierung oder bis zur Löschung durch Nutzende.",
                  "Nutzungsfunktion; kein Banner erforderlich.",
                ],
                [
                  "Cache Storage kinavela-shell-v1 und Service Worker",
                  "Offline-Shell und statische Dateien; keine Kontoinhalte.",
                  "Bis Service-Worker-Update, Deinstallation oder Browser-Löschung.",
                  "Streng erforderlich für die aktivierte PWA-Shell.",
                ],
              ],
            },
          },
          {
            paragraphs: [
              "Der aktuelle öffentliche Produktionsschlüssel für Web Push ist leer; Push-Abonnementspeicherung und Zustellung sind daher nicht aktiviert. Kinavela bindet kein Zahlungs-Widget ein und speichert keine Zahlungsdaten im Browser; die von Stripe gehosteten Checkout- und Portal-Seiten öffnen auf der Stripe-Infrastruktur. Über die Datenschutzeinstellungen kann die Metrik-Wahl geändert werden; der Dienst bleibt bei Ablehnung nutzbar.",
              "Ändern Sie die optionale Metrik-Wahl über die untenstehende Steuerung oder löschen Sie die Website-Daten in Ihrem Browser.",
            ],
          },
        ],
      },
      "child-safety": {
        intro:
          "Kinavela ist ein von Erwachsenen geführter Familiendienst. Der Schutz von Kindern hat Vorrang vor Engagement, Wachstum und Inhaltserhaltung. Kinder haben keine öffentlichen Konten; von Sorgeberechtigten verwaltete Kinderprofile sind standardmäßig privat.",
        sections: [
          {
            title: "Verbotenes Verhalten",
            bullets: [
              "Sexuelle Inhalte mit einem Kind, Grooming oder sexuelle Kontaktanbahnung.",
              "Anfragen nach privaten Kontaktdaten, Schule oder genauem Standort eines Kindes.",
              "Ausbeutung, Menschenhandel, Zwang, Drohungen oder glaubhafte Gefahr.",
              "Weitergabe intimer, demütigender oder identifizierender Kinderbilder ohne rechtmäßige Befugnis.",
              "Versuche, Sichtbarkeit durch Sorgeberechtigte, Blocks oder Moderation zu umgehen.",
            ],
          },
          {
            title: "Meldung",
            paragraphs: [
              "Melden Sie vermutete Kinderschutz-, Sicherheits- oder Missbrauchsfälle über die In-Produkt-Meldung oder an {{info}} mit dem Betreff „Dringender Kinderschutz“ oder „Sicherheitsmeldung“. Hängen Sie kein rechtswidriges Material sexuellen Kindesmissbrauchs an und verbreiten Sie es nicht weiter. Geben Sie nur die Mindestinformationen an, die zur Identifizierung von Konto oder Inhalt erforderlich sind. Eine eigene Sicherheitsadresse besteht derzeit nicht.",
              "Eventkarten bieten feste Meldegründe für unsichere Orte, unangemessenes Verhalten, irreführende Events, Kinderschutzbedenken, Diskriminierung, Betrug und andere Bedenken. Village-Moderierende können ein gemeldetes Event einschränken oder absagen und es an die globale Moderationswarteschlange von Kinavela weiterleiten. Dringende Kinderschutzmeldungen können von Village-Moderierenden nicht abgewiesen werden.",
            ],
          },
          {
            title: "Bearbeitung und Eskalation",
            paragraphs: [
              "Meldungen werden so bald wie angemessen möglich priorisiert; eine garantierte Reaktionszeit wird nicht zugesagt. Interne Betriebsziele sind eine Stunde für kritische Kinderschutzmeldungen, 24 Stunden für hohe Schweregrade, 72 Stunden für mittlere Schweregrade und sieben Tage für niedrige Schweregrade. Dringende Meldungen haben Vorrang, Inhalte können während der Prüfung eingeschränkt werden und ein minimaler Nachweis kann aus Sicherheits- oder Rechtsgründen aufbewahrt werden. Bei unmittelbarer Gefahr kontaktieren Sie Notdienste sowie die Kinderschutz- oder Strafverfolgungsbehörde im Land der Gefahr. Kinavela ist kein Notdienst.",
            ],
          },
          {
            title: "Hinweise für Treffen außerhalb des Internets",
            paragraphs: [
              "Vor der ersten verbindlichen Event-Zusage oder bestätigten persönlichen Begegnung muss ein Erwachsener bestätigen, sich zunächst öffentlich zu treffen, keine Schul- oder direkten Kontaktdaten eines Kindes weiterzugeben, Kinder zu beaufsichtigen, die Weitergabe genauer Adressen zu kontrollieren, bei Unwohlsein Blockieren/Melden zu nutzen und bei unmittelbarer Gefahr Notdienste zu rufen. Die Bestätigung überträgt die Verantwortung von Sorgeberechtigten nicht auf Kinavela.",
            ],
          },
          {
            title: "Steuerung durch Sorgeberechtigte",
            paragraphs: [
              "Sorgeberechtigte steuern die Sichtbarkeit von Kindern und können über Einstellungen oder {{privacy}} Auskunft, Berichtigung oder Löschung verlangen. Kindinhalte und private Medien werden im Kontolöschverfahren gelöscht oder eingeschränkt, vorbehaltlich Sicherheits- und Rechtsaufbewahrung.",
            ],
          },
        ],
      },
      "community-guidelines": {
        intro:
          "Kinavela ist ein gemeinsamer Raum für Familienherkunft und vertrauensvolle Community. Beteiligen Sie sich achtsam, mit kultureller Demut und Respekt für die Grenzen jeder Familie.",
        sections: [
          {
            title: "Tun Sie Folgendes",
            bullets: [
              "Fragen Sie, bevor Sie die Geschichte, das Bild oder Kontaktdaten einer anderen Person teilen.",
              "Verwenden Sie genaue, nicht aufdringliche Profilinformationen.",
              "Respektieren Sie Sprache, Kultur, Behinderung, Religion, Identität und Familienentscheidungen.",
              "Halten Sie Kinderinformationen unter Kontrolle der Sorgeberechtigten und auf das Notwendige beschränkt.",
              "Nutzen Sie Blocks und Meldungen, wenn sich eine Verbindung oder Unterhaltung unsicher anfühlt.",
            ],
          },
          {
            title: "Tun Sie Folgendes nicht",
            bullets: [
              "Belästigen, bedrohen, diskriminieren, verfolgen, doxxen oder sich als andere Person ausgeben.",
              "Spammen, betrügen, um Geld bitten oder jemanden zu einem Offline-Treffen drängen.",
              "Genaue Adressen, private Kontaktdaten oder Daten einer anderen Familie veröffentlichen.",
              "Rechtswidrige, hasserfüllte, ausbeuterische oder sexuelle Kinderinhalte hochladen.",
              "Moderation, Kontobeschränkungen oder den Block einer anderen Person umgehen.",
            ],
          },
          {
            title: "Meldungen und Moderation",
            paragraphs: [
              "Verwenden Sie die In-Produkt-Meldung für Bedenken zu Familien, Nachrichten, Villages, Events und Village-Unterstützung. Nennen Sie in Unterstützungsbeiträgen oder Antworten keine Kindernamen, Schulen, genauen Adressen, Kontaktdaten oder Einwanderungsunterlagen. Sicherheits- und Kinderschutzmeldungen können auch an {{info}} gesendet werden. Moderierende können Sichtbarkeit einschränken, Inhalte entfernen, einen minimalen Sicherheitsdatensatz aufbewahren und Konten sperren. Wir wollen der Schwere und Glaubhaftigkeit einer Meldung angemessen handeln; eine garantierte Moderationszeit wird nicht zugesagt.",
            ],
          },
          {
            title: "Bedeutung von Verifizierung",
            paragraphs: [
              "Die E-Mail-Verifizierung bestätigt die Kontrolle über eine E-Mail-Adresse. Optionale Telefonverifizierung bestätigt die Kontrolle über eine Telefonnummer. Die Community-Verifizierung dokumentiert entweder eine Empfehlung durch eine etablierte, bereits community-verifizierte Village-Moderation oder eine Prüfung durch Kinavela-Mitarbeitende. Diese Prüfungen beweisen keine Identität, sofern nicht ausdrücklich angegeben, garantieren kein Verhalten und bedeuten niemals, dass Kinavela eine Person für sicher erklärt hat.",
            ],
          },
          {
            title: "Einsprüche und Fehler",
            paragraphs: [
              "Wenn Sie eine Maßnahme für fehlerhaft halten, kontaktieren Sie {{info}} mit dem betreffenden Konto und der Maßnahme. Veröffentlichen Sie entfernte Inhalte nicht erneut, solange ein Einspruch läuft.",
            ],
          },
        ],
      },
    },
  },
  fr: {
    labels: {
      privacy: "Politique de confidentialité",
      terms: "Conditions d’utilisation",
      impressum: "Mentions légales",
      cookies: "Politique relative aux cookies et au stockage du navigateur",
      "child-safety": "Politique de protection de l’enfance",
      "community-guidelines": "Règles de la communauté",
    },
    navigationLabel: "Documents juridiques",
    eyebrow: "MENTIONS LÉGALES · KINAVELA",
    meta: "Version 1.2 · En vigueur le 11 août 2026 · Dernière mise à jour le 15 août 2026",
    generalContact: "Contact général :",
    controller: { email: "E-mail", legalForm: "Entreprise individuelle" },
    documents: {
      privacy: {
        intro:
          "Cette politique explique comment Kinavela traite les données personnelles dans les fonctions familiales, patrimoniales et communautaires exploitées par Gestiona Tech – Nguenkam Charles. Elle s’applique au site public, à l’espace compte, à l’inscription, à Roots Passport, Roots Stories, aux Villages, événements, messages, notifications, à la modération et aux demandes liées à la vie privée.",
        sections: [
          {
            title: "1. Responsable du traitement et contact confidentialité",
            paragraphs: [
              "Pour toute question sur la vie privée, l’exercice de vos droits ou une opposition, contactez {{privacy}}. Cette adresse est le contact confidentialité. Aucun délégué à la protection des données n’a été désigné ; cette adresse ne doit pas être comprise comme un contact de DPO.",
            ],
          },
          {
            title: "2. Données traitées",
            bullets: [
              "Données de compte : adresse e-mail, identifiant d’authentification, langue, fuseau horaire, nom d’affichage, état de vérification et du compte.",
              "Données familiales et de découverte : nom et biographie de la famille, pays et ville, localisation approximative choisie par recherche de ville/code postal, rayon, visibilité, disponibilités, intérêts, cultures et langues.",
              "Données d’enfant gérées par un responsable : surnom, année de naissance, mois de naissance et genre facultatifs, réglages de visibilité et contenu Roots Passport géré par le responsable. Kinavela ne crée pas de comptes publics pour enfants et ne demande pas de date de naissance exacte.",
              "Données de contenu et de sécurité : messages, récits, enregistrements vocaux, transcriptions, signalements, actions de modération, participation à des événements et événements de sécurité/audit.",
              "Données opérationnelles : enregistrements de consentement, préférences de notification et, en cas d’activation expresse, clés Push, métriques produit internes après consentement et métadonnées techniques nécessaires à la protection du service.",
            ],
            paragraphs: [
              "Les informations culturelles, patrimoniales et linguistiques peuvent révéler des aspects sensibles de l’identité. Elles sont fournies volontairement et utilisées uniquement pour les fonctions familiales et de découverte choisies. N’ajoutez pas d’information sur une autre personne sans y être autorisé.",
            ],
          },
          {
            title: "3. Finalités et bases légales",
            bullets: [
              "Compte, inscription, outils familiaux, Roots, messages et fonctions communautaires : exécution du contrat demandé, art. 6, §1, b) RGPD.",
              "Sécurité, prévention des abus, modération, traitement des incidents et intégrité du service : intérêts légitimes, art. 6, §1, f) RGPD, et obligations légales le cas échéant, art. 6, §1, c) RGPD.",
              "E-mails produit facultatifs : consentement, art. 6, §1, a) RGPD ; révocable à tout moment dans les réglages.",
              "Métriques produit internes facultatives et stockage associé : consentement enregistré dans le panneau de confidentialité. Le refus ne réduit pas l’accès au service.",
              "Documents fiscaux, comptables et autres documents légaux : obligation légale, art. 6, §1, c) RGPD, lorsque l’obligation existe.",
            ],
          },
          {
            title: "4. Enfants et responsables",
            paragraphs: [
              "Kinavela est un service géré par des adultes. Un parent ou autre responsable autorisé doit saisir et gérer les données d’enfant. Les profils d’enfants sont privés par défaut ; la visibilité pour les connexions ou Villages n’est disponible que via des réglages contrôlés par le responsable. Ne publiez pas l’adresse exacte, les coordonnées directes, la date de naissance exacte, l’école ou des médias sensibles d’un enfant. Un responsable peut demander rectification, export ou suppression via les contrôles du compte ou {{privacy}}.",
            ],
          },
          {
            title: "5. Destinataires et sous-traitants utilisés en production",
            bullets: [
              "Supabase pour l’authentification, la base PostgreSQL, le stockage privé et Realtime. Il reçoit les données de compte, famille, contenu, sécurité et fonctionnement nécessaires à la fonction.",
              "Zoho Europe SMTP à smtp.zoho.eu pour les e-mails de compte et de notification expressément acceptés. Il reçoit l’adresse du destinataire et le minimum nécessaire à la livraison.",
              "Nominatim / OpenStreetMap pour les recherches explicites de ville ou code postal côté serveur lors de l’inscription et de la découverte. La requête peut inclure pays, ville/code postal et langue de l’interface ; le GPS précis de l’appareil n’est pas utilisé.",
              "Stripe pour le Checkout hébergé de l’abonnement Roots Family, les sessions du portail client et les webhooks de paiement signés. Stripe reçoit les informations de paiement et identifiants de facturation nécessaires ; Kinavela ne reçoit pas les données complètes de carte.",
              "Sentry (région allemande) pour la surveillance technique des erreurs et performances. Les données sont limitées aux erreurs et traces techniques, modèles de route, environnement d’exécution, navigateur ou appareil et à un échantillon de performances. L’adresse IP technique peut être traitée pendant le transport réseau. Les données personnelles par défaut, Session Replay, formulaires, corps de requête, messages, récits, transcriptions et données d’enfant sont désactivés ou filtrés avant l’envoi.",
            ],
            paragraphs: [
              "Le traitement OpenAI, les analyses tierces, la publicité, CAPTCHA et la livraison Web Push ne sont pas activés en production. Stripe n’est actif que pour la facturation Roots Family décrite ci-dessus. Si un autre sous-traitant est activé, cette politique et le parcours de consentement seront mis à jour avant le traitement.",
            ],
          },
          {
            title: "6. Transferts internationaux",
            paragraphs: [
              "Des transferts peuvent avoir lieu lorsqu’un sous-traitant ou son infrastructure se trouve hors de l’Espace économique européen. Nous utilisons les garanties exigées par le droit applicable, notamment une décision d’adéquation, des clauses contractuelles types ou un autre mécanisme autorisé. Cette politique ne prétend pas que tout traitement de production est limité à l’EEE.",
            ],
          },
          {
            title: "7. Conservation et suppression",
            paragraphs: [
              "Les données ne sont pas conservées plus longtemps que nécessaire à leur finalité. La tâche automatisée de conservation s’exécute via le cron de confidentialité. La suppression d’un compte enlève d’abord les médias privés, supprime le contenu d’enfant et les récits lorsque cela est techniquement possible, anonymise les messages rédigés et ne laisse qu’un marqueur minimal de sécurité/intégrité lorsqu’une clé étrangère ou un besoin de sécurité empêche une suppression physique immédiate.",
            ],
            table: {
              headers: ["Ressource", "Durée réelle/de conservation"],
              rows: retentionRows.fr,
            },
          },
          {
            paragraphs: [
              "Lorsqu’une obligation comptable ou fiscale existe, l’enregistrement légalement requis est conservé pour cette obligation avec un accès restreint. Les identifiants de facturation Stripe et les métadonnées d’audit de webhook minimisées sont conservés pour l’autorisation d’abonnement, l’assistance, la comptabilité et les obligations légales.",
            ],
          },
          {
            title: "8. Vos droits",
            paragraphs: [
              "Sous réserve des conditions légales, vous pouvez demander l’accès, la rectification, l’effacement, la limitation, la portabilité ou vous opposer au traitement. Vous pouvez retirer votre consentement à tout moment ; ce retrait n’affecte pas la licéité du traitement déjà effectué. Utilisez les réglages lorsqu’ils sont disponibles ou contactez {{privacy}}. Vous avez également le droit d’introduire une réclamation auprès de l’autorité compétente.",
            ],
          },
          {
            title: "9. Autorité de contrôle",
            paragraphs: [
              "L’autorité de contrôle compétente pour le siège du responsable est Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz (LfDI Rheinland-Pfalz), Postfach 30 40, 55020 Mainz ; adresse visiteurs Hintere Bleiche 34, 55116 Mainz ; téléphone +49 (0) 6131 8920-0 ; e-mail {{authority}} ; datenschutz.rlp.de.",
            ],
          },
        ],
      },
      terms: {
        intro:
          "Ces conditions régissent Kinavela, un service familial, patrimonial et communautaire respectueux de la vie privée, exploité par Gestiona Tech – Nguenkam Charles. En créant un compte ou en utilisant une fonction, vous acceptez ces conditions, la politique de confidentialité et les règles de la communauté associées.",
        sections: [
          {
            title: "1. Éligibilité et responsabilité du responsable",
            paragraphs: [
              "Le service est destiné aux adultes. Vous devez avoir au moins 18 ans, pouvoir conclure un contrat et être autorisé à fournir toute information familiale ou d’enfant soumise. Vous restez responsable de son exactitude et de son utilisation licite.",
            ],
          },
          {
            title: "2. Utilisation sûre et respectueuse",
            paragraphs: [
              "Vous devez respecter les règles de la communauté. Vous ne devez pas harceler, discriminer, menacer, usurper une identité, divulguer des données personnelles, escroquer, pratiquer le grooming, exploiter ou approcher sexuellement un enfant, téléverser un contenu illicite ou abusif, contourner une restriction de sécurité ou obtenir des coordonnées ou localisations privées sans consentement. Une compatibilité, un profil ou un événement ne constitue pas une garantie de sécurité.",
            ],
          },
          {
            title: "3. Contenu utilisateur et autorisations",
            paragraphs: [
              "Vous conservez les droits sur le contenu soumis. Vous accordez à Gestiona Tech une autorisation limitée et non exclusive pour l’héberger, le sécuriser, le traiter techniquement et l’afficher uniquement dans la mesure nécessaire à la fonction et aux publics que vous choisissez. Vous devez disposer des droits et autorisations nécessaires pour chaque récit, enregistrement, image, message ou entrée relative à un enfant. Les médias privés ne sont pas publics par défaut.",
            ],
          },
          {
            title: "4. Modération et mesures relatives au compte",
            paragraphs: [
              "Nous pouvons examiner les signalements, limiter la visibilité, retirer du contenu, suspendre ou fermer des comptes, ou contacter les autorités lorsque cela est raisonnablement nécessaire pour protéger les personnes, les enfants, le service ou des droits légaux. Après le retrait d’un contenu ou d’un compte, un enregistrement de sécurité minimal peut être conservé pour enquête ou conformité légale.",
            ],
          },
          {
            title: "5. Disponibilité et modifications",
            paragraphs: [
              "Kinavela est un service en évolution. Des fonctions peuvent être modifiées, limitées ou interrompues pour des raisons de sécurité, maintenance, droit ou fonctionnement. Nous ne garantissons ni disponibilité ininterrompue, ni compatibilité particulière, ni résultat d’événement ou d’IA, ni le comportement d’un autre utilisateur.",
            ],
          },
          {
            title: "6. Fonctions payantes",
            paragraphs: [
              "Les abonnements Roots Family sont facturés 5,99 € par mois ou 59,99 € par an. Le plan annuel est une facturation récurrente annuelle et est présenté comme une économie de 16 pour cent par rapport à douze paiements mensuels. Les abonnements se renouvellent automatiquement jusqu’à annulation via le portail client Stripe. En cas d’annulation en fin de période, l’accès reste disponible jusqu’à la fin de la période payée. Stripe traite les informations de paiement ; Kinavela ne reçoit pas les données complètes de carte. Les droits impératifs de rétractation, remboursement, garantie légale et autres droits des consommateurs restent inchangés.",
            ],
          },
          {
            title: "7. Responsabilité",
            paragraphs: [
              "Aucune disposition ne limite une responsabilité qui ne peut légalement être limitée, notamment en cas d’intention, négligence grave, atteinte à la vie, au corps ou à la santé, ou protection impérative des consommateurs. Sous cette réserve, la responsabilité est limitée dans la mesure permise par la loi, notamment pour les événements, interactions et contenus d’utilisateurs, indisponibilités et pertes indirectes sans manquement à une obligation contractuelle essentielle.",
            ],
          },
          {
            title: "8. Droit applicable et juridiction",
            paragraphs: [
              "Le droit allemand s’applique, sous réserve des règles impératives de protection du consommateur du pays de votre résidence habituelle. Le siège de Gestiona Tech à Mainz n’est compétent que lorsque la loi le permet ; ces conditions n’imposent pas Mainz comme juridiction exclusive aux consommateurs.",
            ],
          },
          {
            title: "9. Contact",
            paragraphs: [
              "Les questions, notifications et signalements de sécurité peuvent être envoyés à {{info}}.",
            ],
          },
        ],
      },
      impressum: {
        sections: [
          {
            title: "Prestataire",
            paragraphs: [
              "Forme juridique : entreprise individuelle. Propriétaire et représentant responsable : Nguenkam Charles.",
              "Registre du commerce : non inscrit. Numéro d’identification économique : DE455342848. Aucun numéro de TVA n’a été fourni ; aucun n’est inventé ni publié ici. Le numéro fiscal n’est pas publié.",
            ],
          },
          {
            title: "Contact",
            paragraphs: [
              "Contact général : {{info}}. Questions de confidentialité : {{privacy}}. Aucun délégué à la protection des données n’a été désigné.",
            ],
          },
          {
            title: "Règlement des litiges de consommation",
            paragraphs: [
              "La plateforme européenne de règlement des litiges en ligne a été supprimée. Nous ne sommes pas tenus et, sauf obligation légale contraire, ne nous engageons pas à participer à une procédure de règlement des litiges devant une commission d’arbitrage de consommation.",
            ],
          },
          {
            title: "Responsable du contenu",
            paragraphs: [
              "Le prestataire responsable du contenu de ce site est Nguenkam Charles à l’adresse ci-dessus. Les liens externes sont vérifiés lors de leur création ; le contenu des pages tierces liées reste sous la responsabilité de leurs exploitants.",
            ],
          },
        ],
      },
      cookies: {
        intro:
          "Kinavela n’utilise actuellement aucun cookie publicitaire, de réseau social, de marketing ou d’analyse tierce. Le tableau suivant décrit les cookies internes et stockages de navigateur utilisés par l’application déployée.",
        sections: [
          {
            table: {
              headers: [
                "Nom / technologie",
                "Finalité",
                "Durée",
                "Consentement",
              ],
              rows: [
                [
                  "Famille de cookies Supabase Auth sb-lchpxzbjawqpirqlhqlh-auth-token (suffixes de fragments possibles)",
                  "Authentification et continuité de session.",
                  "Jusqu’à la déconnexion ou l’expiration de session/rafraîchissement Supabase Auth.",
                  "Strictement nécessaire.",
                ],
                [
                  "kinavela:metrics-consent dans localStorage",
                  "Mémorise le choix d’activer les métriques produit internes.",
                  "Jusqu’à modification ou suppression du choix.",
                  "Mémoire du consentement ; les métriques exigent un opt-in.",
                ],
                [
                  "kinavela:app_session_started dans sessionStorage",
                  "Évite les événements de métriques de session en double après opt-in.",
                  "Jusqu’à la fin de l’onglet ou de la session.",
                  "Écrit uniquement après consentement aux métriques.",
                ],
                [
                  "Base IndexedDB kinavela-offline-v1",
                  "Instantanés hors ligne Passport/Missions choisis par l’utilisateur.",
                  "30 jours sans actualisation ou jusqu’à suppression par l’utilisateur.",
                  "Action de fonctionnalité ; aucune bannière nécessaire.",
                ],
                [
                  "Cache Storage kinavela-shell-v1 et service worker",
                  "Interface hors ligne et fichiers statiques ; aucun contenu de compte.",
                  "Jusqu’à mise à jour du service worker, désinstallation ou effacement du navigateur.",
                  "Strictement nécessaire à l’interface PWA activée.",
                ],
              ],
            },
          },
          {
            paragraphs: [
              "La clé publique Web Push de production actuelle est vide ; le stockage et la livraison d’abonnements Push ne sont donc pas activés. Kinavela n’intègre aucun widget de paiement et ne stocke pas de données de paiement dans le navigateur ; les pages Checkout et Portal hébergées par Stripe s’ouvrent sur l’infrastructure Stripe. Le panneau de confidentialité permet de modifier le choix relatif aux métriques ; le service reste utilisable en cas de refus.",
              "Pour modifier le choix facultatif relatif aux métriques, utilisez le contrôle ci-dessous ou effacez les données du site dans votre navigateur.",
            ],
          },
        ],
      },
      "child-safety": {
        intro:
          "Kinavela est un service familial géré par des adultes. La sécurité des enfants prévaut sur l’engagement, la croissance et la conservation de contenu. Les enfants n’ont pas de comptes publics ; les profils d’enfants gérés par un responsable sont privés par défaut.",
        sections: [
          {
            title: "Comportements interdits",
            bullets: [
              "Contenu sexuel impliquant un enfant, grooming ou sollicitation sexuelle.",
              "Demandes de coordonnées privées, d’école ou de localisation exacte d’un enfant.",
              "Exploitation, traite, coercition, menaces ou danger crédible.",
              "Partage d’images intimes, humiliantes ou identifiantes d’enfants sans autorité légale.",
              "Tentatives de contourner la visibilité du responsable, les blocages ou la modération.",
            ],
          },
          {
            title: "Signalement",
            paragraphs: [
              "Signalez les problèmes présumés de protection de l’enfance, de sécurité ou d’abus via le parcours de signalement du produit ou à {{info}} avec l’objet « Urgent sécurité enfant » ou « Signalement de sécurité ». Ne joignez ni ne redistribuez de matériel illégal d’abus sexuel sur enfant. Fournissez uniquement le minimum nécessaire pour identifier le compte ou le contenu. Il n’existe pas d’adresse de sécurité distincte à ce jour.",
              "Les cartes d’événements proposent des motifs fixes pour lieu dangereux, comportement inapproprié, événement trompeur, préoccupation pour la sécurité d’un enfant, discrimination, fraude et autres préoccupations. Les modérateurs de Village peuvent restreindre ou annuler un événement signalé et l’escalader vers la file globale de modération Kinavela. Les signalements urgents relatifs à la sécurité d’enfants ne peuvent pas être rejetés par les modérateurs de Village.",
            ],
          },
          {
            title: "Traitement et escalade",
            paragraphs: [
              "Les signalements sont triés dès que raisonnablement possible ; aucun délai de réponse garanti n’est promis. Les objectifs opérationnels internes sont d’une heure pour les signalements critiques liés aux enfants, 24 heures pour la gravité élevée, 72 heures pour la gravité moyenne et sept jours pour la gravité faible. Les signalements urgents sont prioritaires, le contenu peut être restreint pendant examen et une preuve minimale peut être conservée pour des raisons de sécurité ou de droit. En cas de danger immédiat, contactez les services d’urgence et l’autorité de protection de l’enfance ou de police du pays où se trouve le danger. Kinavela n’est pas un service d’urgence.",
            ],
          },
          {
            title: "Conseils pour les rencontres hors ligne",
            paragraphs: [
              "Avant le premier RSVP ferme à un événement ou la première rencontre en personne confirmée, un adulte doit reconnaître les conseils suivants : se rencontrer d’abord dans un lieu public, ne pas partager l’école ni les coordonnées directes d’un enfant, superviser les enfants, contrôler le partage de l’adresse exacte, utiliser blocage/signalement en cas d’inconfort et appeler les secours en cas de danger immédiat. Cette reconnaissance ne transfère pas la responsabilité du responsable à Kinavela.",
            ],
          },
          {
            title: "Contrôles du responsable",
            paragraphs: [
              "Les responsables contrôlent la visibilité des enfants et peuvent demander accès, rectification ou effacement dans les réglages ou via {{privacy}}. Le contenu des enfants et les médias privés sont supprimés ou restreints lors d’un effacement de compte, sous réserve de conservation pour sécurité ou droit.",
            ],
          },
        ],
      },
      "community-guidelines": {
        intro:
          "Kinavela est un espace partagé pour l’héritage familial et une communauté de confiance. Participez avec soin, humilité culturelle et respect des limites de chaque famille.",
        sections: [
          {
            title: "À faire",
            bullets: [
              "Demandez avant de partager l’histoire, l’image ou les coordonnées d’une autre personne.",
              "Utilisez des informations de profil exactes et non intrusives.",
              "Respectez la langue, la culture, le handicap, la religion, l’identité et les choix familiaux.",
              "Gardez les informations relatives aux enfants sous contrôle du responsable et limitées au nécessaire.",
              "Utilisez les blocages et signalements lorsqu’une connexion ou une conversation semble dangereuse.",
            ],
          },
          {
            title: "À ne pas faire",
            bullets: [
              "Harceler, menacer, discriminer, traquer, divulguer des données personnelles ou usurper une identité.",
              "Envoyer du spam, escroquer, solliciter de l’argent ou pousser quelqu’un à une rencontre hors ligne.",
              "Publier une adresse exacte, des coordonnées privées ou les données d’une autre famille.",
              "Téléverser du contenu illicite, haineux, exploiteur ou sexuel impliquant des enfants.",
              "Contourner la modération, les restrictions de compte ou le blocage d’une autre personne.",
            ],
          },
          {
            title: "Signalements et modération",
            paragraphs: [
              "Utilisez le parcours de signalement du produit pour les préoccupations relatives à une famille, un message, un Village, un événement ou l’entraide Village. N’indiquez pas de nom d’enfant, école, adresse exacte, coordonnées ou document d’immigration dans une publication ou réponse d’entraide. Les signalements de sécurité et de protection de l’enfance peuvent aussi être envoyés à {{info}}. Les modérateurs peuvent limiter la visibilité, retirer du contenu, conserver une trace minimale de sécurité et suspendre des comptes. Nous cherchons à agir selon la gravité et la crédibilité du signalement ; aucun délai de modération garanti n’est promis.",
            ],
          },
          {
            title: "Ce que signifie la vérification",
            paragraphs: [
              "La vérification d’e-mail confirme le contrôle d’une adresse e-mail. La vérification téléphonique facultative confirme le contrôle d’un numéro. La vérification communautaire enregistre soit l’aval d’un modérateur de Village établi et déjà vérifié par la communauté, soit un examen par le personnel Kinavela. Ces contrôles ne prouvent pas l’identité sauf indication explicite, ne garantissent pas un comportement et ne signifient jamais que Kinavela a déclaré une personne sûre.",
            ],
          },
          {
            title: "Recours et erreurs",
            paragraphs: [
              "Si vous pensez qu’une mesure est erronée, contactez {{info}} avec le compte et la mesure concernés. Ne republiez pas de contenu retiré pendant l’examen d’un recours.",
            ],
          },
        ],
      },
    },
  },
  en: {
    labels: {
      privacy: "Privacy policy",
      terms: "Terms of service",
      impressum: "Impressum",
      cookies: "Cookie and browser-storage policy",
      "child-safety": "Child safety policy",
      "community-guidelines": "Community guidelines",
    },
    navigationLabel: "Legal documents",
    eyebrow: "LEGAL · KINAVELA",
    meta: "Version 1.2 · Effective 11 August 2026 · Last updated 15 August 2026",
    generalContact: "General contact:",
    controller: { email: "Email", legalForm: "Einzelunternehmen" },
    documents: {
      privacy: {
        intro:
          "This Privacy Policy explains how Kinavela processes personal data in the family, heritage and community features operated by Gestiona Tech – Nguenkam Charles. It applies to the public website, account area, onboarding, Roots Passport, Roots Stories, Villages, events, messaging, notifications, moderation and privacy requests.",
        sections: [
          {
            title: "1. Controller and privacy contact",
            paragraphs: [
              "For privacy questions, rights requests or objections, use {{privacy}}. This is the privacy contact. No formal Data Protection Officer has been appointed; this address must not be understood as a DPO contact.",
            ],
          },
          {
            title: "2. Data we process",
            paragraphs: [
              "Kinavela processes account and authentication data; family and discovery data; guardian-managed child data; messages, stories, recordings, transcripts, reports and moderation data; and the minimum consent, notification, push, metrics and technical security data needed to operate the features. Cultural, heritage and language information is voluntary and may reveal sensitive identity aspects. Do not enter information about another person unless authorised.",
            ],
          },
          {
            title: "3. Purposes and legal bases",
            paragraphs: [
              "Requested account, family, Roots, messaging and community features are processed under Art. 6(1)(b) GDPR. Security, abuse prevention, moderation, incidents and integrity use legitimate interests under Art. 6(1)(f) GDPR and legal obligations where applicable under Art. 6(1)(c). Optional product email and metrics require consent; statutory accounting and tax records use Art. 6(1)(c).",
            ],
          },
          {
            title: "4. Children and guardians",
            paragraphs: [
              "Kinavela is adult-led. A parent or authorised guardian enters and manages child information. Child profiles are private by default. Do not publish a child’s exact address, direct contact details, exact birth date, school details or sensitive media. A guardian may request correction, export or deletion through account controls or {{privacy}}.",
            ],
          },
          {
            title: "5. Recipients and processors",
            paragraphs: [
              "Production uses Supabase for authentication, PostgreSQL, private Storage and Realtime; Zoho Europe SMTP for account and opted-in notification email; Nominatim / OpenStreetMap for explicit city or postcode searches; Stripe for hosted Roots Family billing; and Sentry in its Germany region for technical error and performance monitoring. Sentry receives minimized error and stack-trace data, route patterns, runtime, browser or device information and sampled performance data; a technical IP address may be processed in network transit. Default personal data, Session Replay, forms, request bodies, messages, stories, transcripts and child data are disabled or filtered before sending. OpenAI, third-party analytics, advertising, CAPTCHA and Web Push delivery are not enabled in production.",
            ],
          },
          {
            title: "6. International transfers",
            paragraphs: [
              "Transfers may occur when a processor or infrastructure is outside the EEA. We use safeguards required by applicable law, including an adequacy decision, standard contractual clauses or another permitted mechanism where required.",
            ],
          },
          {
            title: "7. Retention and deletion",
            paragraphs: [
              "Data is retained no longer than needed for its purpose. Account deletion removes private media first, deletes child and story content where technically possible, anonymises authored messages and leaves only a minimal safety/integrity tombstone where immediate physical deletion is prevented.",
            ],
            table: {
              headers: ["Resource", "Actual/retained period"],
              rows: retentionRows.en,
            },
          },
          {
            title: "8. Your rights",
            paragraphs: [
              "Subject to legal conditions, you may request access, correction, deletion, restriction, portability or object to processing. You may withdraw consent at any time. Use Settings where available or contact {{privacy}}. You may also complain to the competent supervisory authority.",
            ],
          },
          {
            title: "9. Supervisory authority",
            paragraphs: [
              "The authority for the controller’s seat is Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz (LfDI Rheinland-Pfalz), Postfach 30 40, 55020 Mainz; visitor address Hintere Bleiche 34, 55116 Mainz; telephone +49 (0) 6131 8920-0; email {{authority}}; datenschutz.rlp.de.",
            ],
          },
        ],
      },
      terms: {
        intro:
          "These Terms govern Kinavela, a privacy-focused family, heritage and community service operated by Gestiona Tech – Nguenkam Charles. By creating an account or using a feature, you agree to these Terms, the Privacy Policy and Community Guidelines.",
        sections: [
          {
            title: "1. Eligibility and guardian responsibility",
            paragraphs: [
              "The service is for adults. You must be at least 18, able to contract and authorised to provide submitted family or child information. You remain responsible for accuracy and lawful use.",
            ],
          },
          {
            title: "2. Safe and respectful use",
            paragraphs: [
              "Do not harass, discriminate, threaten, impersonate, dox, scam, groom, exploit or sexually approach a child; upload unlawful or abusive content; evade safety restrictions; or obtain private contact or location information without consent. A match, profile or event is not a safety guarantee.",
            ],
          },
          {
            title: "3. User content and permissions",
            paragraphs: [
              "You retain rights in submitted content and grant Gestiona Tech a limited, non-exclusive permission to host, secure, technically process and display it only as needed for the feature and audiences you select. You need the rights and permissions for every story, recording, image, message and child-related entry. Private media is not public by default.",
            ],
          },
          {
            title: "4. Moderation and account actions",
            paragraphs: [
              "We may review reports, limit visibility, remove content, suspend or close accounts, or contact authorities when reasonably necessary to protect people, children, the service or legal rights. A minimal safety record may be retained for investigation or compliance.",
            ],
          },
          {
            title: "5. Availability and changes",
            paragraphs: [
              "Features may change, be limited or end for security, maintenance, legal or operational reasons. We do not promise uninterrupted availability, a particular match, event outcome, AI result or another user’s conduct.",
            ],
          },
          {
            title: "6. Paid features",
            paragraphs: [
              "Roots Family is billed monthly at €5.99 or annually at €59.99. The annual plan is a recurring yearly charge and is presented as saving 16 percent compared with twelve monthly payments. Subscriptions renew until cancelled through the Stripe Customer Portal; paid access remains through the current period. Mandatory consumer withdrawal, refund, warranty and other consumer rights remain unaffected.",
            ],
          },
          {
            title: "7. Liability",
            paragraphs: [
              "Nothing limits liability that cannot legally be limited, including intent, gross negligence, injury to life, body or health, or mandatory consumer protections. Otherwise liability is limited to the legally permissible extent.",
            ],
          },
          {
            title: "8. Governing law and venue",
            paragraphs: [
              "German law applies, subject to mandatory consumer-protection rules in your habitual residence. Mainz is a competent venue only where legally permitted and is not imposed as an exclusive venue on consumers.",
            ],
          },
          {
            title: "9. Contact",
            paragraphs: [
              "Questions, notices and safety reports can be sent to {{info}}.",
            ],
          },
        ],
      },
      impressum: {
        sections: [
          {
            title: "Provider",
            paragraphs: [
              "Legal form: Einzelunternehmen. Owner and responsible representative: Nguenkam Charles.",
              "Handelsregister: Nicht eingetragen. Wirtschafts-Identifikationsnummer: DE455342848. No VAT ID has been provided or published. The tax number is not published.",
            ],
          },
          {
            title: "Contact",
            paragraphs: [
              "General contact: {{info}}. Privacy matters: {{privacy}}. No formal DPO has been designated.",
            ],
          },
          {
            title: "Consumer dispute resolution",
            paragraphs: [
              "The European Online Dispute Resolution platform has been discontinued. We are not obliged and, unless legally required otherwise, do not undertake to participate in proceedings before a consumer arbitration board.",
            ],
          },
          {
            title: "Responsible content",
            paragraphs: [
              "Nguenkam Charles is responsible for this website’s content at the address above. External links are checked when created; third-party operators remain responsible for linked pages.",
            ],
          },
        ],
      },
      cookies: {
        intro:
          "Kinavela currently uses no advertising, social-media, marketing or third-party analytics cookie. The following first-party cookies and browser storage are used by the deployed application.",
        sections: [
          {
            table: {
              headers: ["Name / technology", "Purpose", "Duration", "Consent"],
              rows: [
                [
                  "Supabase Auth cookie family sb-lchpxzbjawqpirqlhqlh-auth-token",
                  "Authentication and session continuity.",
                  "Until logout or Supabase Auth session/refresh expiry.",
                  "Strictly necessary.",
                ],
                [
                  "kinavela:metrics-consent in localStorage",
                  "Stores the choice to enable first-party product metrics.",
                  "Until changed or cleared.",
                  "Consent memory; metrics require opt-in.",
                ],
                [
                  "kinavela:app_session_started in sessionStorage",
                  "Prevents duplicate opt-in session metric events.",
                  "Until browser tab/session ends.",
                  "Only written after metrics consent.",
                ],
                [
                  "IndexedDB kinavela-offline-v1",
                  "Optional user-selected offline Passport/Missions snapshots.",
                  "30 days without refresh or until cleared.",
                  "User feature action; no banner needed.",
                ],
                [
                  "Cache Storage kinavela-shell-v1 and service worker",
                  "Offline shell and static assets; no account content.",
                  "Until update, uninstall or browser clear.",
                  "Strictly necessary for the enabled PWA shell.",
                ],
              ],
            },
          },
          {
            paragraphs: [
              "The production Web Push public key is currently empty, so push subscription storage and delivery are not enabled. Kinavela does not embed a payment widget or store payment details in browser storage; Stripe Checkout and Portal are hosted on Stripe infrastructure. Use the control below or browser site-data controls to change the optional metrics choice.",
            ],
          },
        ],
      },
      "child-safety": {
        intro:
          "Kinavela is an adult-led family service. Child safety takes priority over engagement, growth and preserving content. Children do not have public accounts; guardian-managed child profiles are private by default.",
        sections: [
          {
            title: "Prohibited conduct",
            bullets: [
              "Sexual content involving a child, grooming or sexual solicitation.",
              "Requests for a child’s private contact details, school or exact location.",
              "Exploitation, trafficking, coercion, threats or credible danger.",
              "Sharing intimate, humiliating or identifying child imagery without lawful authority.",
              "Attempts to bypass guardian visibility, blocks or moderation.",
            ],
          },
          {
            title: "Reporting",
            paragraphs: [
              "Report suspected child-safety, security or abuse issues through the in-product flow or {{info}} with “Urgent child safety” or “Security report”. Do not attach or redistribute illegal child sexual-abuse material. Provide only the minimum needed to identify the account or content.",
            ],
          },
          {
            title: "Handling and escalation",
            paragraphs: [
              "Reports are triaged as soon as reasonably practicable; no response-time SLA is guaranteed. Urgent reports are prioritised and content may be restricted while reviewed. For immediate danger, contact emergency services and the child-protection or law-enforcement authority where the danger occurs. Kinavela is not an emergency service.",
            ],
          },
          {
            title: "Offline meeting guidance",
            paragraphs: [
              "Before a first firm RSVP or confirmed in-person meeting, an adult must acknowledge public-first meeting, child supervision, controlled exact-address sharing, no sharing of a child’s school/direct contact details, block/report use and emergency escalation. This does not transfer guardian responsibility to Kinavela.",
            ],
          },
          {
            title: "Guardian controls",
            paragraphs: [
              "Guardians control child visibility and can request access, correction or deletion in Settings or through {{privacy}}.",
            ],
          },
        ],
      },
      "community-guidelines": {
        intro:
          "Kinavela is a shared space for family heritage and trusted community. Participate with care, cultural humility and respect for each family’s boundaries.",
        sections: [
          {
            title: "Do",
            bullets: [
              "Ask before sharing another person’s story, image or contact details.",
              "Use accurate, non-invasive profile information.",
              "Respect language, culture, disability, religion, identity and family choices.",
              "Keep children’s information guardian-controlled and minimal.",
              "Use blocks and reports when a connection or conversation feels unsafe.",
            ],
          },
          {
            title: "Do not",
            bullets: [
              "Harass, threaten, discriminate, stalk, dox or impersonate.",
              "Spam, defraud, solicit money or pressure someone to meet offline.",
              "Publish exact addresses, private contact details or another family’s data.",
              "Upload unlawful, hateful, exploitative or sexual child content.",
              "Circumvent moderation, account restrictions or another person’s block.",
            ],
          },
          {
            title: "Reports and moderation",
            paragraphs: [
              "Use the in-product report flow for family, message, Village, event and Village-support concerns. Do not put child names, schools, exact addresses, contact details or immigration documents in support posts or replies. Safety and child-protection reports may also be sent to {{info}}. Moderators may limit visibility, remove content, preserve a minimal safety record and suspend accounts.",
            ],
          },
          {
            title: "What verification means",
            paragraphs: [
              "Email verification confirms control of an email address. Optional phone verification confirms control of a phone number. Community verification records either an endorsement by an established community-verified Village moderator or a Kinavela staff review. These checks do not prove identity unless stated, do not guarantee conduct and never mean that Kinavela has declared a person safe.",
            ],
          },
          {
            title: "Appeals and mistakes",
            paragraphs: [
              "If you believe an action was mistaken, contact {{info}} with the relevant account and action. Do not republish removed content while an appeal is pending.",
            ],
          },
        ],
      },
    },
  },
};
