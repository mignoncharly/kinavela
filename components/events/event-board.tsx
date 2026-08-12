"use client";

import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import type {
  EventAttendeeResult,
  EventResult,
} from "@/features/events/results";
import type { Locale } from "@/lib/i18n/config";
import { eventCategories } from "@/lib/validation/events";

export type EventCopy = (typeof import("@/messages/en.json"))["events"];

function localInputValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formPayload(form: FormData) {
  const capacity = String(form.get("max_families") ?? "").trim();
  return {
    title: String(form.get("title") ?? ""),
    description: String(form.get("description") ?? ""),
    category: String(form.get("category") ?? "other"),
    starts_at: new Date(String(form.get("starts_at"))).toISOString(),
    ends_at: new Date(String(form.get("ends_at"))).toISOString(),
    location_name: String(form.get("location_name") ?? ""),
    location_city: String(form.get("location_city") ?? ""),
    location_address: String(form.get("location_address") ?? ""),
    public_location_description: String(
      form.get("public_location_description") ?? "",
    ),
    address_visibility: String(form.get("address_visibility") ?? "going"),
    max_families: capacity ? Number(capacity) : null,
    registration_deadline: new Date(
      String(form.get("registration_deadline")),
    ).toISOString(),
  };
}

async function eventAction(body: object) {
  return fetch("/api/events/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function EventForm({
  villageId,
  event,
  copy,
}: {
  villageId: string;
  event?: EventResult;
  copy: EventCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const fields = formPayload(new FormData(submitEvent.currentTarget));
      const response = await fetch("/api/events", {
        method: event ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          event
            ? { event_id: event.event_id, ...fields }
            : { village_id: villageId, ...fields },
        ),
      });
      if (!response.ok) throw new Error("event_action_failed");
      setBusy(false);
      if (!event) submitEvent.currentTarget.reset();
      router.refresh();
    } catch {
      setBusy(false);
      setError(true);
    }
  }
  return (
    <details className="event-form-panel">
      <summary>{event ? copy.edit : copy.create}</summary>
      <form className="event-form" onSubmit={submit}>
        <label>
          {copy.name}
          <input
            name="title"
            defaultValue={event?.title}
            minLength={3}
            maxLength={120}
            required
          />
        </label>
        <label>
          {copy.description}
          <textarea
            name="description"
            defaultValue={event?.description}
            minLength={10}
            maxLength={2000}
            required
          />
        </label>
        <div className="event-form-grid">
          <label>
            {copy.category}
            <select
              name="category"
              defaultValue={event?.category ?? "cultural"}
            >
              {eventCategories.map((category) => (
                <option key={category} value={category}>
                  {copy.categories[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.capacity}
            <input
              name="max_families"
              type="number"
              min={1}
              max={100}
              defaultValue={event?.max_families ?? ""}
              placeholder={copy.unlimited}
            />
          </label>
          <label>
            {copy.starts}
            <input
              name="starts_at"
              type="datetime-local"
              defaultValue={
                event ? localInputValue(event.starts_at) : undefined
              }
              required
            />
          </label>
          <label>
            {copy.ends}
            <input
              name="ends_at"
              type="datetime-local"
              defaultValue={event ? localInputValue(event.ends_at) : undefined}
              required
            />
          </label>
          <label>
            {copy.deadline}
            <input
              name="registration_deadline"
              type="datetime-local"
              defaultValue={
                event ? localInputValue(event.registration_deadline) : undefined
              }
              required
            />
          </label>
          <label>
            {copy.locationName}
            <input
              name="location_name"
              defaultValue={event?.location_name}
              minLength={2}
              maxLength={120}
              required
            />
          </label>
          <label>
            {copy.locationCity}
            <input
              name="location_city"
              defaultValue={event?.location_city}
              minLength={2}
              maxLength={120}
              required
            />
          </label>
          <label>
            {copy.addressVisibility}
            <select
              name="address_visibility"
              defaultValue={event?.address_visibility ?? "going"}
            >
              <option value="going">{copy.goingOnly}</option>
              <option value="all_members">{copy.allMembers}</option>
            </select>
          </label>
        </div>
        <label>
          {copy.publicLocation}
          <input
            name="public_location_description"
            defaultValue={event?.public_location_description}
            minLength={2}
            maxLength={240}
            required
          />
          <small>{copy.publicLocationHelp}</small>
        </label>
        <label>
          {copy.privateAddress}
          <input
            name="location_address"
            defaultValue={event?.location_address ?? ""}
            minLength={5}
            maxLength={300}
            autoComplete="street-address"
            required
          />
          <small>{copy.privateAddressHelp}</small>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {copy.actionError}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? copy.saving : copy.save}
        </button>
      </form>
    </details>
  );
}

function RsvpForm({ event, copy }: { event: EventResult; copy: EventCopy }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const registrationOpen =
    event.status === "scheduled" &&
    new Date(event.registration_deadline) >= new Date();
  if (!registrationOpen)
    return <p className="event-closed">{copy.registrationClosed}</p>;
  return (
    <form
      className="event-rsvp"
      onSubmit={async (submitEvent) => {
        submitEvent.preventDefault();
        setBusy(true);
        setError(false);
        const form = new FormData(submitEvent.currentTarget);
        const response = await eventAction({
          action: "rsvp",
          event_id: event.event_id,
          status: String(form.get("status")),
          number_of_adults: Number(form.get("number_of_adults")),
          number_of_children: Number(form.get("number_of_children")),
        });
        if (response.ok) router.refresh();
        else {
          setBusy(false);
          setError(true);
        }
      }}
    >
      <label>
        {copy.rsvp}
        <select
          name="status"
          defaultValue={
            event.current_rsvp_status === "waitlisted"
              ? "going"
              : (event.current_rsvp_status ?? "going")
          }
        >
          <option value="going">{copy.going}</option>
          <option value="maybe">{copy.maybe}</option>
          <option value="declined">{copy.declined}</option>
        </select>
      </label>
      <label>
        {copy.adults}
        <input
          name="number_of_adults"
          type="number"
          min={0}
          max={10}
          defaultValue={event.number_of_adults ?? 1}
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
          defaultValue={event.number_of_children ?? 0}
          required
        />
      </label>
      <button className="button button-primary" disabled={busy}>
        {busy ? copy.saving : copy.rsvp}
      </button>
      {error && (
        <small className="form-error" role="alert">
          {copy.actionError}
        </small>
      )}
    </form>
  );
}

function ManagerActions({
  event,
  attendees,
  copy,
}: {
  event: EventResult;
  attendees: EventAttendeeResult[];
  copy: EventCopy;
}) {
  const router = useRouter();
  const [error, setError] = useState(false);
  async function act(body: object) {
    setError(false);
    const response = await eventAction(body);
    if (response.ok) router.refresh();
    else setError(true);
  }
  return (
    <section className="event-manager">
      {event.status === "scheduled" && (
        <div className="inline-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => act({ action: "remind", event_id: event.event_id })}
          >
            <Bell size={16} /> {copy.sendReminder}
          </button>
          <button
            className="button danger-button"
            type="button"
            onClick={() => act({ action: "cancel", event_id: event.event_id })}
          >
            <XCircle size={16} /> {copy.cancel}
          </button>
        </div>
      )}
      <h4>{copy.attendees}</h4>
      {attendees.length === 0 ? (
        <p>{copy.noRsvps}</p>
      ) : (
        <ul className="event-attendee-list">
          {attendees.map((attendee) => (
            <li key={attendee.family_id}>
              <span>
                <strong>{attendee.family_name}</strong>
                <small>
                  {copy[attendee.status]} · {attendee.number_of_adults}{" "}
                  {copy.adults.toLowerCase()} · {attendee.number_of_children}{" "}
                  {copy.children.toLowerCase()}
                </small>
              </span>
              {attendee.status === "going" && (
                <button
                  className={
                    attendee.attendance_confirmed
                      ? "attendance-confirmed"
                      : "attendance-button"
                  }
                  type="button"
                  onClick={() =>
                    act({
                      action: "attendance",
                      event_id: event.event_id,
                      family_id: attendee.family_id,
                      attended: !attendee.attendance_confirmed,
                    })
                  }
                >
                  <CheckCircle2 size={16} /> {copy.attended}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="form-error" role="alert">
          {copy.actionError}
        </p>
      )}
    </section>
  );
}

const reminderLabel = (event: EventResult, copy: EventCopy) => {
  switch (event.latest_reminder_kind) {
    case "scheduled_24h":
      return copy.scheduledReminder;
    case "event_updated":
      return copy.eventUpdated;
    case "event_cancelled":
      return copy.eventCancelled;
    case "waitlist_promoted":
      return copy.waitlistPromoted;
    default:
      return copy.reminderSent;
  }
};

export function EventBoard({
  villageId,
  events,
  attendeesByEvent,
  canCreate,
  locale,
  copy,
}: {
  villageId: string;
  events: EventResult[];
  attendeesByEvent: Record<string, EventAttendeeResult[]>;
  canCreate: boolean;
  locale: Locale;
  copy: EventCopy;
}) {
  const router = useRouter();
  const dateLocale =
    locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : "en-GB";
  return (
    <div className="event-board">
      <header className="event-board-heading">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>
        {canCreate && <CalendarDays />}
      </header>
      {canCreate && <EventForm villageId={villageId} copy={copy} />}
      {events.length === 0 ? (
        <div className="phase-empty">
          <CalendarDays />
          <p>{copy.noEvents}</p>
        </div>
      ) : (
        <div className="event-list">
          {events.map((event) => (
            <article
              className={`event-card ${event.status}`}
              key={event.event_id}
            >
              {event.reminder_unread && (
                <div className="event-reminder" role="status">
                  <Bell />
                  <span>{reminderLabel(event, copy)}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await eventAction({
                        action: "read_reminders",
                        event_id: event.event_id,
                      });
                      router.refresh();
                    }}
                  >
                    {copy.markRead}
                  </button>
                </div>
              )}
              <div className="event-card-heading">
                <div>
                  <span className="event-category">
                    {copy.categories[event.category]}
                  </span>
                  <h3>{event.title}</h3>
                  <p>
                    {copy.createdBy.replace(
                      "{family}",
                      event.creator_family_name,
                    )}
                  </p>
                </div>
                {event.status !== "scheduled" && (
                  <span className="event-status">{copy[event.status]}</span>
                )}
              </div>
              <p className="event-description">{event.description}</p>
              <dl className="event-facts">
                <div>
                  <dt>
                    <Clock size={16} /> {copy.starts}
                  </dt>
                  <dd>
                    {new Intl.DateTimeFormat(dateLocale, {
                      dateStyle: "full",
                      timeStyle: "short",
                    }).format(new Date(event.starts_at))}
                  </dd>
                </div>
                <div>
                  <dt>
                    <MapPin size={16} /> {copy.locationName}
                  </dt>
                  <dd>
                    {event.location_name} · {event.location_city}
                    <small>{event.public_location_description}</small>
                  </dd>
                </div>
                <div>
                  <dt>
                    <Users size={16} /> {copy.capacity}
                  </dt>
                  <dd>
                    {copy.familyCount.replace(
                      "{count}",
                      String(event.going_count),
                    )}{" "}
                    ·{" "}
                    {copy.maybeCount.replace(
                      "{count}",
                      String(event.maybe_count),
                    )}
                    {event.waitlist_count > 0
                      ? ` · ${copy.waitlistCount.replace("{count}", String(event.waitlist_count))}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>
                    <ShieldCheck size={16} /> {copy.exactAddress}
                  </dt>
                  <dd>{event.location_address ?? copy.addressHidden}</dd>
                </div>
              </dl>
              {event.current_rsvp_status && (
                <span className={`rsvp-state ${event.current_rsvp_status}`}>
                  {copy[event.current_rsvp_status]}
                </span>
              )}
              {event.status === "scheduled" && (
                <RsvpForm event={event} copy={copy} />
              )}
              {event.can_manage && (
                <>
                  {event.status === "scheduled" && (
                    <EventForm
                      villageId={villageId}
                      event={event}
                      copy={copy}
                    />
                  )}
                  <ManagerActions
                    event={event}
                    attendees={attendeesByEvent[event.event_id] ?? []}
                    copy={copy}
                  />
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
