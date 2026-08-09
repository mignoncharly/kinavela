"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Locale } from "@/lib/i18n/config";

type Mode = "signup" | "login" | "forgot" | "update";
type Props = { locale: Locale; mode: Mode };

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
    generic: "Das hat nicht geklappt. Bitte prüfe die Eingaben.",
    passwordHelp: "Mindestens 12 Zeichen, Groß-/Kleinbuchstabe und Zahl.",
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
    generic: "Une erreur est survenue. Vérifiez vos informations.",
    passwordHelp: "12 caractères minimum avec majuscule, minuscule et chiffre.",
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
    generic: "Something went wrong. Please check your details.",
    passwordHelp: "At least 12 characters with upper/lowercase and a number.",
  },
} as const;

export function AuthForm({ locale, mode }: Props) {
  const t = labels[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const endpoint =
      mode === "forgot"
        ? "/api/auth/recovery"
        : mode === "update"
          ? "/api/auth/update-password"
          : `/api/auth/${mode}`;
    const body: Record<string, unknown> = { locale };
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
      const result = (await response.json()) as {
        ok?: boolean;
        redirect?: string;
      };
      if (!response.ok || !result.ok) throw new Error("request_failed");
      if (result.redirect) router.push(result.redirect);
      else if (mode === "update")
        router.push(`/${locale}/app/settings?password=updated`);
      else setMessage(t.check);
    } catch {
      setError(t.generic);
    } finally {
      setBusy(false);
    }
  }

  async function magicLink(form: HTMLFormElement) {
    const email = new FormData(form).get("email");
    if (!email) return setError(t.generic);
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, locale }),
    });
    setBusy(false);
    if (response.ok) setMessage(t.check);
    else setError(t.generic);
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
              {t.terms} <Link href={`/${locale}/terms`}>Terms</Link> ·{" "}
              <Link href={`/${locale}/privacy`}>Privacy</Link>
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
