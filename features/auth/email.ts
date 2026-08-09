import "server-only";

import { sendTransactionalEmail } from "@/lib/email/transport";
import type { Locale } from "@/lib/i18n/config";

type AuthKind = "signup" | "magiclink" | "recovery";
type Copy = { subject: string; title: string; action: string; note: string };

const copy: Record<Locale, Record<AuthKind, Copy>> = {
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
};

export async function sendAuthEmail(
  to: string,
  locale: Locale,
  kind: AuthKind,
  actionUrl: string,
) {
  const message = copy[locale][kind];
  const escapedUrl = actionUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  await sendTransactionalEmail({
    to,
    subject: message.subject,
    text: `${message.title}\n\n${message.action}: ${actionUrl}\n\n${message.note}\n\nKinavela`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#26352e"><p style="letter-spacing:.16em;font-weight:700">KINAVELA</p><h1 style="font-family:Georgia,serif;font-weight:400">${message.title}</h1><p><a href="${escapedUrl}" style="display:inline-block;background:#9f4334;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:700">${message.action}</a></p><p style="color:#6d746e;font-size:14px">${message.note}</p></div>`,
  });
}
