"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";
import { useRouter } from "next/navigation";

export function SettingsForm({
  name,
  locale,
}: {
  name: string;
  locale: Locale;
}) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  const copy = getAppDictionary(locale).settings;
  return (
    <form
      className="settings-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            display_name: form.get("name"),
            preferred_language: form.get("language"),
          }),
        });
        setMessage(response.ok ? copy.saved : copy.saveFailed);
        const nextLocale = String(form.get("language"));
        if (response.ok && nextLocale !== locale) {
          router.push(`/${nextLocale}/app/settings`);
          router.refresh();
        }
      }}
    >
      <label>
        {copy.displayName}
        <input
          name="name"
          defaultValue={name}
          minLength={2}
          maxLength={80}
          required
        />
      </label>
      <label>
        {copy.interfaceLanguage}
        <select name="language" defaultValue={locale}>
          <option value="de">{copy.languageOptions.de}</option>
          <option value="fr">{copy.languageOptions.fr}</option>
          <option value="en">{copy.languageOptions.en}</option>
        </select>
      </label>
      <button className="button button-primary">{copy.saveChanges}</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
