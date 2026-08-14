"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { isLocale, type Locale } from "@/lib/i18n/config";

export function DocumentLanguage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const segment = pathname?.split("/")[1] ?? "de";
    const requestedLocale =
      segment === "offline" ? (searchParams.get("locale") ?? "de") : segment;
    const locale: Locale = isLocale(requestedLocale) ? requestedLocale : "de";
    document.documentElement.lang = locale;
  }, [pathname, searchParams]);

  return null;
}
