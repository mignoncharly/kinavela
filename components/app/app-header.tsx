import Link from "next/link";

import { LogoutButton } from "@/components/app/account-actions";
import type { Locale } from "@/lib/i18n/config";

type AppRoute =
  | "home"
  | "discover"
  | "connections"
  | "messages"
  | "villages"
  | "missions"
  | "roots"
  | "stories"
  | "notifications"
  | "settings";

const labels = {
  de: {
    home: "Start",
    discover: "Entdecken",
    connections: "Kontakte",
    messages: "Nachrichten",
    villages: "Villages",
    missions: "Missionen",
    roots: "Roots Passport",
    stories: "Roots Stories",
    notifications: "Mitteilungen",
    settings: "Einstellungen",
    menu: "Mehr",
  },
  fr: {
    home: "Accueil",
    discover: "Découvrir",
    connections: "Connexions",
    messages: "Messages",
    villages: "Villages",
    missions: "Missions",
    roots: "Roots Passport",
    stories: "Roots Stories",
    notifications: "Notifications",
    settings: "Réglages",
    menu: "Plus",
  },
  en: {
    home: "Home",
    discover: "Discover",
    connections: "Connections",
    messages: "Messages",
    villages: "Villages",
    missions: "Missions",
    roots: "Roots Passport",
    stories: "Roots Stories",
    notifications: "Notifications",
    settings: "Settings",
    menu: "More",
  },
} satisfies Record<Locale, Record<AppRoute | "menu", string>>;

const primaryRoutes: Array<{ id: AppRoute; path: string }> = [
  { id: "home", path: "" },
  { id: "discover", path: "/discover" },
  { id: "connections", path: "/connections" },
  { id: "messages", path: "/messages" },
  { id: "villages", path: "/villages" },
];

const secondaryRoutes: Array<{ id: AppRoute; path: string }> = [
  { id: "missions", path: "/missions" },
  { id: "roots", path: "/roots" },
  { id: "stories", path: "/stories" },
  { id: "notifications", path: "/notifications" },
  { id: "settings", path: "/settings" },
];

export function AppHeader({
  active,
  locale,
  unreadCount = 0,
}: {
  active: AppRoute;
  locale: Locale;
  unreadCount?: number;
}) {
  const copy = labels[locale];

  return (
    <header className="app-header">
      <Link className="brand" href={`/${locale}/app`}>
        <span className="brand-mark" aria-hidden="true">
          K
        </span>
        <span>KINAVELA</span>
      </Link>

      <nav className="app-primary-nav" aria-label="Application">
        {primaryRoutes.map((route) => (
          <Link
            aria-current={active === route.id ? "page" : undefined}
            href={`/${locale}/app${route.path}`}
            key={route.id}
          >
            {copy[route.id]}
            {route.id === "messages" && unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </Link>
        ))}
      </nav>

      <details className="app-nav-menu">
        <summary>{copy.menu}</summary>
        <div className="app-nav-menu-panel">
          <nav aria-label={copy.menu}>
            {secondaryRoutes.map((route) => (
              <Link
                aria-current={active === route.id ? "page" : undefined}
                href={`/${locale}/app${route.path}`}
                key={route.id}
              >
                {copy[route.id]}
              </Link>
            ))}
          </nav>
          <LogoutButton locale={locale} />
        </div>
      </details>
    </header>
  );
}
