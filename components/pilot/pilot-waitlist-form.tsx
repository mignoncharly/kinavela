"use client";

import { useState } from "react";

export function PilotWaitlistForm() {
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/pilot/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        country_code: "DE",
        city,
        culture_focus: "cameroon",
      }),
    });
    setMessage(
      response.ok
        ? "You are on the regional pilot waitlist."
        : "We could not add this city yet.",
    );
    setBusy(false);
  }
  return (
    <section className="pilot-waitlist">
      <h2>Not in an open pilot area?</h2>
      <p>
        Join the Germany waitlist. Kinavela opens a city when enough nearby
        families are ready.
      </p>
      <form onSubmit={submit}>
        <label>
          City
          <input
            required
            minLength={2}
            maxLength={120}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="e.g. Stuttgart"
          />
        </label>
        <button className="button button-secondary" disabled={busy}>
          {busy ? "Joining…" : "Join waitlist"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
