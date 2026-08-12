import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import type { Locale } from "@/lib/i18n/config";

type Mode = "signup" | "login" | "forgot" | "update";

export function AuthPage({ locale, mode }: { locale: Locale; mode: Mode }) {
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
        <p className="eyebrow">PRIVATE BY DESIGN</p>
        <h1>{title}</h1>
        <AuthForm locale={locale} mode={mode} />
        {mode !== "login" && mode !== "update" && (
          <p className="auth-switch">
            <Link href={`/${locale}/auth/login`}>Sign in</Link>
          </p>
        )}
        {mode === "login" && (
          <p className="auth-switch">
            <Link href={`/${locale}/auth/forgot-password`}>
              Forgot password?
            </Link>{" "}
            · <Link href={`/${locale}/auth/signup`}>Create account</Link>
          </p>
        )}
      </section>
      <aside className="auth-aside">
        <p className="eyebrow light">ROOTS × VILLAGE</p>
        <h2>Family, culture and community—with privacy at the centre.</h2>
        <ul>
          <li>Exact addresses are never public</li>
          <li>Children are private by default</li>
          <li>You control discovery visibility</li>
        </ul>
      </aside>
    </main>
  );
}
