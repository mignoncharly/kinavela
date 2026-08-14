"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Locale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";

type Mode = "signup" | "login" | "forgot" | "update";
type Props = {
  locale: Locale;
  mode: Mode;
  inviteToken?: string;
  initialError?: string;
};

const labels = {
  de: {
    signup: "Konto erstellen",
    login: "Anmelden",
    forgot: "Passwort zurücksetzen",
    update: "Neues Passwort",
    name: "Dein Name",
    email: "E-Mail",
    password: "Passwort",
    submitSignup: "Sicher registrieren",
    submitLogin: "Anmelden",
    submitForgot: "Link senden",
    submitUpdate: "Passwort speichern",
    magic: "Anmeldelink per E-Mail",
    terms: "Ich akzeptiere Nutzungsbedingungen und Datenschutz.",
    check: "Prüfe jetzt dein E-Mail-Postfach.",
    passwordHelp: "Mindestens 12 Zeichen, Groß-/Kleinbuchstabe und Zahl.",
    errors: {
      name: "Bitte gib einen Namen mit mindestens 2 Zeichen ein.",
      email: "Bitte gib eine gültige E-Mail-Adresse ein.",
      password:
        "Dein Passwort muss mindestens 12 Zeichen lang sein und Groß- und Kleinbuchstaben sowie eine Zahl enthalten.",
      passwordRequired: "Bitte gib dein Passwort ein.",
      consent:
        "Bitte akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung.",
      invalidCredentials: "E-Mail-Adresse oder Passwort ist nicht korrekt.",
      rateLimited:
        "Zu viele Versuche. Bitte warte 15 Minuten und versuche es dann erneut.",
      invalidRequest:
        "Die Anfrage konnte nicht sicher geprüft werden. Lade die Seite neu und versuche es erneut.",
      invalidInput:
        "Einige Angaben sind ungültig. Bitte prüfe Name, E-Mail-Adresse, Passwort und Zustimmung.",
      signupUnavailable:
        "Die Registrierung ist vorübergehend nicht verfügbar. Es wurde kein Konto erstellt. Bitte versuche es später erneut.",
      serviceUnavailable:
        "Dieser Dienst ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.",
      invalidLink:
        "Dieser Link ist ungültig. Bitte fordere einen neuen Link an.",
      expiredLink:
        "Dieser Link ist abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen Link an.",
      sessionExpired:
        "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
      network:
        "Kinavela ist nicht erreichbar. Prüfe deine Internetverbindung und versuche es erneut.",
      unexpected:
        "Die Antwort konnte nicht verarbeitet werden. Bitte lade die Seite neu und versuche es erneut.",
    },
  },
  fr: {
    signup: "Créer un compte",
    login: "Connexion",
    forgot: "Réinitialiser le mot de passe",
    update: "Nouveau mot de passe",
    name: "Votre nom",
    email: "E-mail",
    password: "Mot de passe",
    submitSignup: "Créer mon compte",
    submitLogin: "Se connecter",
    submitForgot: "Envoyer le lien",
    submitUpdate: "Enregistrer",
    magic: "Lien de connexion par e-mail",
    terms: "J’accepte les conditions et la politique de confidentialité.",
    check: "Consultez maintenant votre boîte e-mail.",
    passwordHelp: "12 caractères minimum avec majuscule, minuscule et chiffre.",
    errors: {
      name: "Veuillez saisir un nom comportant au moins 2 caractères.",
      email: "Veuillez saisir une adresse e-mail valide.",
      password:
        "Votre mot de passe doit comporter au moins 12 caractères, avec une majuscule, une minuscule et un chiffre.",
      passwordRequired: "Veuillez saisir votre mot de passe.",
      consent:
        "Veuillez accepter les conditions d’utilisation et la politique de confidentialité.",
      invalidCredentials: "L’adresse e-mail ou le mot de passe est incorrect.",
      rateLimited:
        "Trop de tentatives. Patientez 15 minutes avant de réessayer.",
      invalidRequest:
        "Cette demande n’a pas pu être vérifiée. Actualisez la page et réessayez.",
      invalidInput:
        "Certaines informations sont invalides. Vérifiez le nom, l’adresse e-mail, le mot de passe et votre consentement.",
      signupUnavailable:
        "L’inscription est temporairement indisponible. Aucun compte n’a été créé. Réessayez plus tard.",
      serviceUnavailable:
        "Ce service est temporairement indisponible. Réessayez plus tard.",
      invalidLink:
        "Ce lien n’est pas valide. Veuillez demander un nouveau lien.",
      expiredLink:
        "Ce lien a expiré ou a déjà été utilisé. Veuillez demander un nouveau lien.",
      sessionExpired: "Votre session a expiré. Veuillez vous reconnecter.",
      network:
        "Impossible de joindre Kinavela. Vérifiez votre connexion internet et réessayez.",
      unexpected:
        "La réponse n’a pas pu être traitée. Actualisez la page et réessayez.",
    },
  },
  en: {
    signup: "Create account",
    login: "Sign in",
    forgot: "Reset password",
    update: "New password",
    name: "Your name",
    email: "Email",
    password: "Password",
    submitSignup: "Create account securely",
    submitLogin: "Sign in",
    submitForgot: "Send reset link",
    submitUpdate: "Save password",
    magic: "Email me a sign-in link",
    terms: "I accept the terms and privacy policy.",
    check: "Check your email inbox now.",
    passwordHelp: "At least 12 characters with upper/lowercase and a number.",
    errors: {
      name: "Enter a name with at least 2 characters.",
      email: "Enter a valid email address.",
      password:
        "Your password must be at least 12 characters and include an uppercase letter, a lowercase letter, and a number.",
      passwordRequired: "Enter your password.",
      consent: "Accept the terms and privacy policy to create your account.",
      invalidCredentials: "The email address or password is incorrect.",
      rateLimited: "Too many attempts. Wait 15 minutes, then try again.",
      invalidRequest:
        "We could not verify this request. Refresh the page and try again.",
      invalidInput:
        "Some details are invalid. Review your name, email, password, and consent.",
      signupUnavailable:
        "Registration is temporarily unavailable. No account was created. Please try again later.",
      serviceUnavailable:
        "This service is temporarily unavailable. Please try again later.",
      invalidLink: "This link is invalid. Please request a new link.",
      expiredLink:
        "This link has expired or was already used. Please request a new link.",
      sessionExpired: "Your session has expired. Please sign in again.",
      network:
        "We could not reach Kinavela. Check your internet connection and try again.",
      unexpected:
        "We could not process the response. Refresh the page and try again.",
    },
  },
} as const;

type AuthResult = {
  ok?: boolean;
  redirect?: string;
  error?: string;
};

function namedInput(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement ? field : null;
}

export function AuthForm({ locale, mode, inviteToken, initialError }: Props) {
  const t = labels[locale];
  const legal = getAppDictionary(locale).authPage;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(() =>
    initialError ? errorFor(initialError) : "",
  );

  function errorFor(code?: string) {
    switch (code) {
      case "invalid_credentials":
        return t.errors.invalidCredentials;
      case "rate_limited":
        return t.errors.rateLimited;
      case "invalid_request":
        return t.errors.invalidRequest;
      case "invalid_input":
        return t.errors.invalidInput;
      case "service_unavailable":
        return mode === "signup"
          ? t.errors.signupUnavailable
          : t.errors.serviceUnavailable;
      case "invalid_link":
        return t.errors.invalidLink;
      case "expired_link":
        return t.errors.expiredLink;
      case "not_authenticated":
        return t.errors.sessionExpired;
      default:
        return t.errors.unexpected;
    }
  }

  function validate(form: HTMLFormElement) {
    if (mode === "signup") {
      const name = namedInput(form, "displayName");
      if (!name || name.value.trim().length < 2 || name.value.length > 80) {
        name?.focus();
        return t.errors.name;
      }
    }

    const email = namedInput(form, "email");
    const emailValue = email?.value.trim() ?? "";
    if (
      mode !== "update" &&
      (emailValue.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue))
    ) {
      email?.focus();
      return t.errors.email;
    }

    const password = namedInput(form, "password");
    const passwordValue = password?.value ?? "";
    if (mode === "signup" || mode === "login" || mode === "update") {
      if (!passwordValue) {
        password?.focus();
        return t.errors.passwordRequired;
      }
      if (
        mode !== "login" &&
        (passwordValue.length < 12 ||
          !/[a-z]/.test(passwordValue) ||
          !/[A-Z]/.test(passwordValue) ||
          !/[0-9]/.test(passwordValue))
      ) {
        password?.focus();
        return t.errors.password;
      }
    }

    if (mode === "signup") {
      const consent = namedInput(form, "consent");
      if (!consent?.checked) {
        consent?.focus();
        return t.errors.consent;
      }
    }

    return null;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const formElement = event.currentTarget;
    const validationMessage = validate(formElement);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setBusy(true);
    const form = new FormData(formElement);
    const endpoint =
      mode === "forgot"
        ? "/api/auth/recovery"
        : mode === "update"
          ? "/api/auth/update-password"
          : `/api/auth/${mode}`;
    const body: Record<string, unknown> = { locale };
    if ((mode === "signup" || mode === "login") && inviteToken)
      body.invite_token = inviteToken;
    if (mode !== "update") body.email = form.get("email");
    if (mode === "signup") {
      body.password = form.get("password");
      body.displayName = form.get("displayName");
      body.acceptTerms = form.get("consent") === "on";
      body.acceptPrivacy = form.get("consent") === "on";
      body.website = form.get("website");
    }
    if (mode === "login" || mode === "update")
      body.password = form.get("password");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response
        .json()
        .catch(() => null)) as AuthResult | null;
      if (!result) {
        setError(t.errors.unexpected);
        return;
      }
      if (!response.ok || !result.ok) {
        setError(errorFor(result.error));
        return;
      }
      if (result.redirect) router.push(result.redirect);
      else if (mode === "update")
        router.push(`/${locale}/app/settings?password=updated`);
      else setMessage(t.check);
    } catch {
      setError(t.errors.network);
    } finally {
      setBusy(false);
    }
  }

  async function magicLink(form: HTMLFormElement) {
    const emailInput = namedInput(form, "email");
    const email = emailInput?.value.trim() ?? "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailInput?.focus();
      setError(t.errors.email);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const result = (await response
        .json()
        .catch(() => null)) as AuthResult | null;
      if (!result) {
        setError(t.errors.unexpected);
        return;
      }
      if (response.ok && result.ok) setMessage(t.check);
      else setError(errorFor(result.error));
    } catch {
      setError(t.errors.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {mode === "signup" && (
        <label>
          {t.name}
          <input
            name="displayName"
            autoComplete="name"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
      )}
      {mode !== "update" && (
        <label>
          {t.email}
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
      )}
      {(mode === "signup" || mode === "login" || mode === "update") && (
        <label>
          {t.password}
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "signup"
                ? "new-password"
                : mode === "login"
                  ? "current-password"
                  : "new-password"
            }
            minLength={mode === "login" ? 1 : 12}
            maxLength={128}
            required
          />
          {mode !== "login" && <small>{t.passwordHelp}</small>}
        </label>
      )}
      {mode === "signup" && (
        <>
          <input
            className="honeypot"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
          <label className="consent">
            <input name="consent" type="checkbox" required />
            <span>
              {t.terms} <Link href={`/${locale}/terms`}>{legal.terms}</Link> ·{" "}
              <Link href={`/${locale}/privacy`}>{legal.privacy}</Link> ·{" "}
              <Link href={"/" + locale + "/community-guidelines"}>
                {legal.community}
              </Link>
            </span>
          </label>
        </>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary" disabled={busy} type="submit">
        {busy
          ? "…"
          : mode === "signup"
            ? t.submitSignup
            : mode === "login"
              ? t.submitLogin
              : mode === "forgot"
                ? t.submitForgot
                : t.submitUpdate}
      </button>
      {mode === "login" && (
        <button
          className="button button-secondary"
          disabled={busy}
          type="button"
          onClick={(event) => void magicLink(event.currentTarget.form!)}
        >
          {t.magic}
        </button>
      )}
    </form>
  );
}
