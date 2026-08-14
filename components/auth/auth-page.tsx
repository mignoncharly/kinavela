import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import type { Locale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";

type Mode = "signup" | "login" | "forgot" | "update";

export function AuthPage({
  locale,
  mode,
  inviteToken,
  initialError,
}: {
  locale: Locale;
  mode: Mode;
  inviteToken?: string;
  initialError?: string;
}) {
  const copy = getAppDictionary(locale).authPage;
  const title =
    mode === "signup"
      ? {
          de: "Dein Kinavela beginnt hier",
          fr: "Votre Kinavela commence ici",
          en: "Your Kinavela starts here",
        }[locale]
      : mode === "login"
        ? { de: "Willkommen zurück", fr: "Bon retour", en: "Welcome back" }[
            locale
          ]
        : mode === "forgot"
          ? {
              de: "Zugang wiederherstellen",
              fr: "Retrouver votre accès",
              en: "Recover your access",
            }[locale]
          : {
              de: "Schütze dein Konto",
              fr: "Sécurisez votre compte",
              en: "Secure your account",
            }[locale];
  return (
    <main className="auth-layout">
      <section className="auth-card">
        <Link className="brand" href={`/${locale}`}>
          <span className="brand-mark">K</span>
          <span>KINAVELA</span>
        </Link>
        <p className="eyebrow">{copy.private}</p>
        <h1>{title}</h1>
        <AuthForm
          locale={locale}
          mode={mode}
          inviteToken={inviteToken}
          initialError={initialError}
        />
        {mode !== "login" && mode !== "update" && (
          <p className="auth-switch">
            <Link
              href={`/${locale}/auth/login${inviteToken ? `?invite=${inviteToken}` : ""}`}
            >
              {copy.signIn}
            </Link>
          </p>
        )}
        {mode === "login" && (
          <p className="auth-switch">
            <Link href={`/${locale}/auth/forgot-password`}>{copy.forgot}</Link>{" "}
            ·{" "}
            <Link
              href={`/${locale}/auth/signup${inviteToken ? `?invite=${inviteToken}` : ""}`}
            >
              {copy.create}
            </Link>
          </p>
        )}
      </section>
      <aside className="auth-aside">
        <p className="eyebrow light">ROOTS × VILLAGE</p>
        <h2>{copy.aside}</h2>
        <ul>
          {copy.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
