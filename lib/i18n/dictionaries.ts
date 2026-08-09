import type { Locale } from "./config";

import de from "@/messages/de.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const dictionaries = { de, en, fr } as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
