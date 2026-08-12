"use client";

import { Download, LockKeyhole, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import type { RootsCopy } from "@/features/roots/copy";
import type { CompletedMission, RootsEntry } from "@/lib/validation/roots";
import { rootsEntryTypes } from "@/lib/validation/roots";

async function rootsAction(body: object) {
  return fetch("/api/roots/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function RootsEntryForm({
  passportId,
  childId,
  missions,
  copy,
}: {
  passportId: string;
  childId: string;
  missions: CompletedMission[];
  copy: RootsCopy;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const form = new FormData(event.currentTarget);
    const type = String(form.get("type"));
    const file = form.get("file");
    const missionId = String(form.get("mission_id") ?? "");
    const occurred = String(form.get("occurred_at") ?? "");
    const body = missionId
      ? {
          action: "mission_entry",
          child_id: childId,
          mission_id: missionId,
          title: String(form.get("title")),
          description: String(form.get("description")),
          occurred_at: occurred ? new Date(occurred).toISOString() : null,
          visibility: String(form.get("visibility")),
        }
      : {
          action: "create_entry",
          child_id: childId,
          type,
          title: String(form.get("title")),
          description: String(form.get("description") || "") || null,
          occurred_at: occurred ? new Date(occurred).toISOString() : null,
          visibility: String(form.get("visibility")),
          culture_id: null,
          language_id: null,
          event_id: null,
          mission_id: null,
          village_id: null,
        };
    const response = await rootsAction(body);
    const payload = (await response.json().catch(() => null)) as {
      entryId?: string;
    } | null;
    if (!response.ok || !payload?.entryId) {
      setBusy(false);
      setError(true);
      return;
    }
    if (file instanceof File && file.size > 0) {
      const media = new FormData();
      media.set("passport_id", passportId);
      media.set("entry_id", payload.entryId);
      media.set("file", file);
      const mediaResponse = await fetch("/api/roots/media", {
        method: "POST",
        body: media,
      });
      if (!mediaResponse.ok) {
        setBusy(false);
        setError(true);
        return;
      }
    }
    event.currentTarget.reset();
    setBusy(false);
    setOpen(false);
    router.refresh();
  }
  if (!open)
    return (
      <button
        className="button button-primary"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Upload size={16} /> {copy.add}
      </button>
    );
  return (
    <form className="roots-form" onSubmit={submit}>
      <div className="roots-form-grid">
        <label>
          {copy.type}
          <select name="type" defaultValue="family_memory">
            {rootsEntryTypes.map((type) => (
              <option key={type} value={type}>
                {copy.types[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {copy.titleLabel}
          <input name="title" minLength={2} maxLength={160} required />
        </label>
        <label>
          {copy.occurred}
          <input name="occurred_at" type="date" />
        </label>
        <label>
          {copy.visibility}
          <select name="visibility">
            <option value="private">{copy.private}</option>
            <option value="family">{copy.family}</option>
          </select>
        </label>
        {missions.length > 0 && (
          <label>
            {copy.mission}
            <select name="mission_id" defaultValue="">
              <option value="">{copy.noMission}</option>
              {missions.map((mission) => (
                <option key={mission.mission_id} value={mission.mission_id}>
                  {mission.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label>
        {copy.description}
        <textarea name="description" maxLength={5000} />
      </label>
      <label>
        {copy.media}
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/mp4,video/mp4,application/pdf"
        />
        <small>{copy.mediaHelp}</small>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {copy.actionError}
        </p>
      )}
      <div className="inline-actions">
        <button className="button button-primary" disabled={busy}>
          {busy ? copy.saving : copy.save}
        </button>
        <button
          className="button button-secondary"
          disabled={busy}
          type="button"
          onClick={() => setOpen(false)}
        >
          {copy.cancel}
        </button>
      </div>
    </form>
  );
}

export function RootsPassportActions({
  childId,
  copy,
}: {
  childId: string;
  copy: RootsCopy;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(false);
  async function requestExport() {
    setBusy(true);
    const response = await rootsAction({ action: "export", child_id: childId });
    setBusy(false);
    if (response.ok) setMessage(true);
  }
  return (
    <div className="roots-actions">
      <button
        className="button button-secondary"
        disabled={busy}
        type="button"
        onClick={requestExport}
      >
        <Download size={16} /> {busy ? copy.exporting : copy.export}
      </button>
      {message && <small className="roots-note">{copy.exportQueued}</small>}
    </div>
  );
}

export function RootsTimeline({
  entries,
  copy,
}: {
  entries: RootsEntry[];
  copy: RootsCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function remove(entryId: string) {
    setBusy(entryId);
    const response = await rootsAction({
      action: "delete_entry",
      entry_id: entryId,
    });
    setBusy(null);
    if (response.ok) router.refresh();
  }
  if (!entries.length) return <p className="muted-copy">{copy.noEntries}</p>;
  return (
    <div className="roots-timeline">
      {entries.map((entry) => (
        <article className="roots-entry" key={entry.entry_id}>
          <div className="roots-entry-top">
            <div>
              <h3>{entry.title}</h3>
              <div className="roots-entry-meta">
                <span>{copy.types[entry.type]}</span>
                <span>{new Date(entry.occurred_at).toLocaleDateString()}</span>
                {entry.culture_name && <span>{entry.culture_name}</span>}
                {entry.language_name && <span>{entry.language_name}</span>}
                {entry.media_available && (
                  <span>
                    <LockKeyhole size={12} /> {copy.attached}
                  </span>
                )}
              </div>
            </div>
            <button
              className="roots-entry-delete"
              disabled={busy !== null}
              type="button"
              onClick={() => remove(entry.entry_id)}
            >
              <Trash2 size={15} />{" "}
              {busy === entry.entry_id ? copy.deleting : copy.delete}
            </button>
          </div>
          {entry.description && <p>{entry.description}</p>}
        </article>
      ))}
    </div>
  );
}
