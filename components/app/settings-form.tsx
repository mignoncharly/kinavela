"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/config";

export function SettingsForm({
  name,
  city,
  locale,
}: {
  name: string;
  city: string;
  locale: Locale;
}) {
  const [message, setMessage] = useState("");
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
            city: form.get("city") || null,
            preferred_language: form.get("language"),
          }),
        });
        setMessage(response.ok ? "Changes saved." : "Could not save changes.");
      }}
    >
      <label>
        Display name
        <input
          name="name"
          defaultValue={name}
          minLength={2}
          maxLength={80}
          required
        />
      </label>
      <label>
        City
        <input name="city" defaultValue={city} minLength={2} maxLength={120} />
      </label>
      <label>
        Language
        <select name="language" defaultValue={locale}>
          <option value="de">Deutsch</option>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </label>
      <button className="button button-primary">Save changes</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
