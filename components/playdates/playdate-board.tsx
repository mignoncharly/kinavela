"use client";

import {
  Bell,
  CalendarPlus,
  Flag,
  MapPin,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { PlaydateResult } from "@/features/playdates/results";
import { playdateCopy } from "@/features/playdates/copy";
import type { Locale } from "@/lib/i18n/config";

async function action(body: object) {
  return fetch("/api/playdates/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function PlaydateProposal({
  connectionId,
  locale,
}: {
  connectionId: string;
  locale: Locale;
}) {
  const copy = playdateCopy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const form = new FormData(event.currentTarget);
    const times = ["time_1", "time_2", "time_3"]
      .map((name) => String(form.get(name) ?? ""))
      .filter(Boolean)
      .map((value) => new Date(value).toISOString());
    const response = await fetch("/api/playdates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connection_id: connectionId,
        title: String(form.get("title")),
        approximate_location: String(form.get("approximate_location")),
        exact_address: String(form.get("exact_address")),
        time_options: times,
        number_of_adults: Number(form.get("number_of_adults")),
        number_of_children: Number(form.get("number_of_children")),
      }),
    });
    setBusy(false);
    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    } else setError(true);
  }
  return (
    <details className="playdate-proposal">
      <summary>
        <CalendarPlus size={16} /> {copy.propose}
      </summary>
      <form onSubmit={submit}>
        <label>
          {copy.title}
          <input name="title" minLength={3} maxLength={120} required />
        </label>
        <label>
          {copy.approximate}
          <input
            name="approximate_location"
            minLength={2}
            maxLength={240}
            required
          />
        </label>
        <label>
          {copy.exact}
          <input
            name="exact_address"
            minLength={5}
            maxLength={300}
            autoComplete="street-address"
            required
          />
          <small>{copy.exactHelp}</small>
        </label>
        <fieldset>
          <legend>{copy.options}</legend>
          {[1, 2, 3].map((number) => (
            <input
              key={number}
              aria-label={`${copy.options} ${number}`}
              name={`time_${number}`}
              type="datetime-local"
              required={number === 1}
            />
          ))}
        </fieldset>
        <div className="playdate-party">
          <label>
            {copy.adults}
            <input
              name="number_of_adults"
              type="number"
              min={0}
              max={10}
              defaultValue={1}
              required
            />
          </label>
          <label>
            {copy.children}
            <input
              name="number_of_children"
              type="number"
              min={0}
              max={20}
              defaultValue={1}
              required
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {copy.error}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? copy.saving : copy.save}
        </button>
      </form>
    </details>
  );
}

function PlaydateCard({
  playdate,
  locale,
}: {
  playdate: PlaydateResult;
  locale: Locale;
}) {
  const copy = playdateCopy[locale];
  const router = useRouter();
  const [error, setError] = useState(false);
  const dateLocale =
    locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : "en-GB";
  const format = (value: string) =>
    new Intl.DateTimeFormat(dateLocale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  async function act(body: object) {
    setError(false);
    const response = await action(body);
    if (response.ok) router.refresh();
    else setError(true);
  }
  return (
    <article className={`playdate-card ${playdate.status}`}>
      {playdate.reminder_unread && (
        <div className="playdate-reminder">
          <Bell size={17} />
          <span>{copy.reminder}</span>
          <button
            type="button"
            onClick={() =>
              act({
                action: "read_reminders",
                playdate_id: playdate.playdate_id,
              })
            }
          >
            {copy.read}
          </button>
        </div>
      )}
      <header>
        <div>
          <span>{copy[playdate.status]}</span>
          <h3>{playdate.title}</h3>
          <p>{playdate.other_family_name}</p>
        </div>
        <MapPin />
      </header>
      <p>
        <strong>{copy.approximate}:</strong> {playdate.approximate_location}
      </p>
      {playdate.selected_starts_at ? (
        <p>
          <strong>{copy.selected}:</strong>{" "}
          {format(playdate.selected_starts_at)}
        </p>
      ) : (
        <ul>
          {playdate.time_options.map((option) => (
            <li key={option.option_id}>{format(option.starts_at)}</li>
          ))}
        </ul>
      )}
      <p className="privacy-note">
        <ShieldCheck size={16} /> <strong>{copy.address}:</strong>{" "}
        {playdate.exact_address ?? copy.hidden}
      </p>
      {playdate.status === "proposed" && !playdate.is_proposer && (
        <form
          className="playdate-response"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void act({
              action: "accept",
              playdate_id: playdate.playdate_id,
              option_id: String(form.get("option_id")),
              number_of_adults: Number(form.get("number_of_adults")),
              number_of_children: Number(form.get("number_of_children")),
            });
          }}
        >
          <p>{copy.incoming}</p>
          <select name="option_id">
            {playdate.time_options.map((option) => (
              <option value={option.option_id} key={option.option_id}>
                {format(option.starts_at)}
              </option>
            ))}
          </select>
          <div className="playdate-party">
            <label>
              {copy.adults}
              <input
                name="number_of_adults"
                type="number"
                min={0}
                max={10}
                defaultValue={1}
                required
              />
            </label>
            <label>
              {copy.children}
              <input
                name="number_of_children"
                type="number"
                min={0}
                max={20}
                defaultValue={1}
                required
              />
            </label>
          </div>
          <div className="inline-actions">
            <button className="button button-primary">{copy.accept}</button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() =>
                act({ action: "decline", playdate_id: playdate.playdate_id })
              }
            >
              {copy.decline}
            </button>
          </div>
        </form>
      )}
      {playdate.status === "proposed" && playdate.is_proposer && (
        <p>{copy.outgoing}</p>
      )}
      {playdate.status === "accepted" && (
        <button
          className="button button-secondary"
          type="button"
          onClick={() =>
            act({ action: "remind", playdate_id: playdate.playdate_id })
          }
        >
          <Bell size={16} /> {copy.remind}
        </button>
      )}
      {(["proposed", "accepted"] as string[]).includes(playdate.status) && (
        <button
          className="button danger-button"
          type="button"
          onClick={() =>
            act({ action: "cancel", playdate_id: playdate.playdate_id })
          }
        >
          <XCircle size={16} /> {copy.cancel}
        </button>
      )}
      {!playdate.is_proposer && (
        <details className="report-panel">
          <summary>
            <Flag size={15} /> {copy.report}
          </summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void act({
                action: "report",
                playdate_id: playdate.playdate_id,
                reason: String(form.get("reason")),
                details: String(form.get("details") ?? ""),
              });
            }}
          >
            <select name="reason">
              <option value="unsafe_location">
                {copy.reportReasons.unsafe_location}
              </option>
              <option value="inappropriate_conduct">
                {copy.reportReasons.inappropriate_conduct}
              </option>
              <option value="child_safety_concern">
                {copy.reportReasons.child_safety_concern}
              </option>
              <option value="discrimination">
                {copy.reportReasons.discrimination}
              </option>
              <option value="fraud">{copy.reportReasons.fraud}</option>
              <option value="other">{copy.reportReasons.other}</option>
            </select>
            <label>
              {copy.reportDetails}
              <textarea name="details" maxLength={900} />
            </label>
            <button className="button button-secondary">
              {copy.reportSend}
            </button>
          </form>
        </details>
      )}
      {error && (
        <p className="form-error" role="alert">
          {copy.error}
        </p>
      )}
    </article>
  );
}

export function PlaydateBoard({
  playdates,
  locale,
}: {
  playdates: PlaydateResult[];
  locale: Locale;
}) {
  const copy = playdateCopy[locale];
  return (
    <section className="playdate-board">
      <header>
        <h2>{copy.heading}</h2>
        <p>{copy.intro}</p>
      </header>
      {playdates.length === 0 ? (
        <p>{copy.noPlaydates}</p>
      ) : (
        <div className="playdate-list">
          {playdates.map((playdate) => (
            <PlaydateCard
              key={playdate.playdate_id}
              playdate={playdate}
              locale={locale}
            />
          ))}
        </div>
      )}
    </section>
  );
}
