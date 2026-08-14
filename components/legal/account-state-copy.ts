import type { Locale } from "@/lib/i18n/config";

export const accountStateCopy = {
  de: {
    eyebrow: "KONTOZUGANG",
    title: "Konto vorübergehend nicht verfügbar",
    body: "Dein Kinavela-Konto ist gesperrt, während unser Moderationsteam es prüft. Wenn du dies für einen Fehler hältst, kontaktiere den Support über die in der Datenschutzerklärung genannte Adresse.",
    return: "Zu Kinavela zurückkehren",
  },
  fr: {
    eyebrow: "ACCÈS AU COMPTE",
    title: "Compte temporairement indisponible",
    body: "Votre compte Kinavela est suspendu pendant son examen par notre équipe de modération. Si vous pensez qu’il s’agit d’une erreur, contactez l’assistance à l’adresse indiquée dans la politique de confidentialité.",
    return: "Retourner à Kinavela",
  },
  en: {
    eyebrow: "ACCOUNT ACCESS",
    title: "Account temporarily unavailable",
    body: "Your Kinavela account is suspended while our moderation team reviews it. If you believe this is a mistake, contact support through the address in the privacy notice.",
    return: "Return to Kinavela",
  },
} satisfies Record<
  Locale,
  Record<"eyebrow" | "title" | "body" | "return", string>
>;
