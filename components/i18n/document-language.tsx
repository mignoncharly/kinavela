"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { isLocale, type Locale } from "@/lib/i18n/config";

export function DocumentLanguage() {
  const pathname = usePathname();

  useEffect(() => {
    const segment = pathname?.split("/")[1] ?? "de";
    const locale: Locale = isLocale(segment) ? segment : "de";
    document.documentElement.lang = locale;
  }, [pathname]);

  return null;
}
