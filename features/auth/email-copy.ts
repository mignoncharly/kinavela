import type { Locale } from "@/lib/i18n/config";

export type AuthEmailKind = "signup" | "magiclink" | "recovery";
type Copy = { subject: string; title: string; action: string; note: string };
type Chrome = { fallback: string; footer: string };

// Wrapper copy shared by every auth email. Spelling out why the recipient got
// the message and showing the destination URL in plain text are both things
// spam filters look for in transactional mail.
export const authEmailChrome = {
  de: {
    fallback: "Oder kopiere diesen Link in deinen Browser:",
    footer:
      "Du erhältst diese E-Mail, weil ein Kinavela-Konto mit dieser Adresse verknüpft ist.",
  },
  fr: {
    fallback: "Ou copiez ce lien dans votre navigateur :",
    footer:
      "Vous recevez cet e-mail car un compte Kinavela est associé à cette adresse.",
  },
  en: {
    fallback: "Or paste this link into your browser:",
    footer:
      "You are receiving this email because a Kinavela account is linked to this address.",
  },
} satisfies Record<Locale, Chrome>;

export const authEmailCopy = {
  de: {
    signup: {
      subject: "Bestätige dein Kinavela-Konto",
      title: "Willkommen bei Kinavela",
      action: "E-Mail bestätigen",
      note: "Dieser Link ist nur für dich bestimmt.",
    },
    magiclink: {
      subject: "Dein Kinavela-Anmeldelink",
      title: "Sicher bei Kinavela anmelden",
      action: "Jetzt anmelden",
      note: "Falls du diesen Link nicht angefordert hast, ignoriere diese Nachricht.",
    },
    recovery: {
      subject: "Kinavela-Passwort zurücksetzen",
      title: "Passwort zurücksetzen",
      action: "Neues Passwort wählen",
      note: "Falls du dies nicht angefordert hast, bleibt dein Passwort unverändert.",
    },
  },
  fr: {
    signup: {
      subject: "Confirmez votre compte Kinavela",
      title: "Bienvenue sur Kinavela",
      action: "Confirmer mon e-mail",
      note: "Ce lien est strictement personnel.",
    },
    magiclink: {
      subject: "Votre lien de connexion Kinavela",
      title: "Connexion sécurisée à Kinavela",
      action: "Se connecter",
      note: "Ignorez cet e-mail si vous n’avez pas demandé ce lien.",
    },
    recovery: {
      subject: "Réinitialisez votre mot de passe Kinavela",
      title: "Réinitialiser le mot de passe",
      action: "Choisir un nouveau mot de passe",
      note: "Si vous n’avez rien demandé, votre mot de passe reste inchangé.",
    },
  },
  en: {
    signup: {
      subject: "Confirm your Kinavela account",
      title: "Welcome to Kinavela",
      action: "Confirm email",
      note: "This private link is for you only.",
    },
    magiclink: {
      subject: "Your Kinavela sign-in link",
      title: "Sign in securely to Kinavela",
      action: "Sign in",
      note: "Ignore this email if you did not request the link.",
    },
    recovery: {
      subject: "Reset your Kinavela password",
      title: "Reset your password",
      action: "Choose a new password",
      note: "If you did not request this, your password remains unchanged.",
    },
  },
} satisfies Record<Locale, Record<AuthEmailKind, Copy>>;
