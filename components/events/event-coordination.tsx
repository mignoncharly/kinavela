"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { EventMessageResult } from "@/features/playdates/results";
import { eventCoordinationCopy } from "@/features/playdates/copy";
import type { Locale } from "@/lib/i18n/config";

export function EventCoordination({
  eventId,
  messages,
  locale,
}: {
  eventId: string;
  messages: EventMessageResult[];
  locale: Locale;
}) {
  const copy = eventCoordinationCopy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/events/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        body: String(form.get("body")),
      }),
    });
    setBusy(false);
    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    } else setError(true);
  }
  return (
    <details className="event-coordination">
      <summary>
        <MessageCircle size={16} /> {copy.heading}
      </summary>
      <p>{copy.intro}</p>
      <div className="event-message-list">
        {messages.length === 0 ? (
          <p>{copy.empty}</p>
        ) : (
          messages.map((message) => (
            <article
              className={message.is_own_family ? "own" : ""}
              key={message.message_id}
            >
              <strong>{message.sender_display_name}</strong>
              <p>{message.body}</p>
            </article>
          ))
        )}
      </div>
      <form onSubmit={submit}>
        <label>
          {copy.label}
          <textarea name="body" minLength={1} maxLength={2000} required />
        </label>
        <button className="button button-primary" disabled={busy}>
          {busy ? copy.sending : copy.send}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {copy.error}
          </p>
        )}
      </form>
    </details>
  );
}
