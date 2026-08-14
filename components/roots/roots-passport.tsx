"use client";

import {
  Download,
  Eye,
  FileDown,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import type { RootsCopy } from "@/features/roots/copy";
import type {
  RootsEntry,
  RootsExport,
  RootsOptions,
} from "@/lib/validation/roots";
import { rootsEntryTypes } from "@/lib/validation/roots";
import type { Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/format";

async function rootsAction(body: object) {
  return fetch("/api/roots/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function emptyToNull(value: FormDataEntryValue | null) {
  const clean = String(value ?? "").trim();
  return clean || null;
}

function optionList(
  name: string,
  label: string,
  emptyLabel: string,
  options: RootsOptions["cultures"],
  defaultValue = "",
) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={defaultValue}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function EntryFields({
  options,
  copy,
  entry,
}: {
  options: RootsOptions;
  copy: RootsCopy;
  entry?: RootsEntry;
}) {
  const [visibility, setVisibility] = useState(entry?.visibility ?? "private");
  return (
    <>
      <div className="roots-form-grid">
        <label>
          {copy.type}
          <select name="type" defaultValue={entry?.type ?? "family_memory"}>
            {rootsEntryTypes.map((type) => (
              <option key={type} value={type}>
                {copy.types[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {copy.titleLabel}
          <input
            name="title"
            defaultValue={entry?.title}
            minLength={2}
            maxLength={160}
            required
          />
        </label>
        <label>
          {copy.occurred}
          <input
            name="occurred_at"
            type="date"
            defaultValue={
              entry
                ? new Date(entry.occurred_at).toISOString().slice(0, 10)
                : ""
            }
            required={Boolean(entry)}
          />
        </label>
        <label>
          {copy.visibility}
          <select
            name="visibility"
            value={visibility}
            onChange={(event) =>
              setVisibility(
                event.target.value as "private" | "family" | "village",
              )
            }
          >
            <option value="private">{copy.private}</option>
            <option value="family">{copy.family}</option>
            <option value="village">{copy.village}</option>
          </select>
        </label>
        {optionList(
          "culture_id",
          copy.culture,
          copy.noCulture,
          options.cultures,
          entry?.culture_id ?? "",
        )}
        {optionList(
          "language_id",
          copy.language,
          copy.noLanguage,
          options.languages,
          entry?.language_id ?? "",
        )}
        {optionList(
          "mission_id",
          copy.mission,
          copy.noMission,
          options.missions,
          entry?.mission_id ?? "",
        )}
        {optionList(
          "event_id",
          copy.event,
          copy.noEvent,
          options.events,
          entry?.event_id ?? "",
        )}
        {visibility === "village" &&
          optionList(
            "village_id",
            copy.sharedVillage,
            copy.chooseVillage,
            options.villages,
            entry?.village_id ?? "",
          )}
      </div>
      <label>
        {copy.description}
        <textarea
          name="description"
          defaultValue={entry?.description ?? ""}
          maxLength={5000}
        />
      </label>
    </>
  );
}

function entryPayload(form: FormData) {
  const occurred = String(form.get("occurred_at") ?? "");
  return {
    type: String(form.get("type")),
    title: String(form.get("title")),
    description: emptyToNull(form.get("description")),
    occurred_at: occurred ? new Date(occurred).toISOString() : null,
    visibility: String(form.get("visibility")),
    culture_id: emptyToNull(form.get("culture_id")),
    language_id: emptyToNull(form.get("language_id")),
    event_id: emptyToNull(form.get("event_id")),
    mission_id: emptyToNull(form.get("mission_id")),
    village_id: emptyToNull(form.get("village_id")),
  };
}

async function uploadMedia(passportId: string, entryId: string, file: File) {
  const media = new FormData();
  media.set("passport_id", passportId);
  media.set("entry_id", entryId);
  media.set("file", file);
  return fetch("/api/roots/media", { method: "POST", body: media });
}

export function RootsEntryForm({
  passportId,
  childId,
  options,
  copy,
}: {
  passportId: string;
  childId: string;
  options: RootsOptions;
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
    const file = form.get("file");
    const response = await rootsAction({
      action: "create_entry",
      child_id: childId,
      ...entryPayload(form),
    });
    const payload = (await response.json().catch(() => null)) as {
      entryId?: string;
    } | null;
    if (
      !response.ok ||
      !payload?.entryId ||
      (file instanceof File &&
        file.size > 0 &&
        !(await uploadMedia(passportId, payload.entryId, file)).ok)
    ) {
      setBusy(false);
      setError(true);
      return;
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
      <EntryFields options={options} copy={copy} />
      <label>
        {copy.media}
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/mp4,video/mp4,application/pdf"
        />
        <small>{copy.mediaHelp}</small>
      </label>
      {error && <p className="form-error">{copy.actionError}</p>}
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
  exports,
  copy,
}: {
  childId: string;
  exports: RootsExport[];
  copy: RootsCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(body: object) {
    setBusy(true);
    const response = await rootsAction(body);
    setBusy(false);
    if (response.ok) router.refresh();
  }
  return (
    <div className="roots-export-panel">
      <button
        className="button button-secondary"
        disabled={
          busy ||
          exports.some((item) => ["queued", "processing"].includes(item.status))
        }
        type="button"
        onClick={() => act({ action: "export", child_id: childId })}
      >
        <Download size={16} /> {busy ? copy.exporting : copy.export}
      </button>
      {exports.slice(0, 3).map((item) => (
        <div className="roots-export-row" key={item.export_id}>
          <span>{copy.exportStatuses[item.status]}</span>
          {item.status === "ready" && (
            <a
              className="button button-secondary"
              href={`/api/roots/exports/${item.export_id}`}
            >
              <FileDown size={15} /> {copy.downloadExport}
            </a>
          )}
          {item.status === "failed" && item.attempts < 3 && (
            <button
              className="button button-secondary"
              disabled={busy}
              type="button"
              onClick={() =>
                act({ action: "retry_export", export_id: item.export_id })
              }
            >
              <RefreshCw size={15} /> {copy.retry}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function MediaControls({
  entry,
  passportId,
  copy,
  busy,
  onBusy,
}: {
  entry: RootsEntry;
  passportId: string;
  copy: RootsCopy;
  busy: boolean;
  onBusy: (value: boolean) => void;
}) {
  const router = useRouter();
  async function replace(file: File) {
    onBusy(true);
    const response = await uploadMedia(passportId, entry.entry_id, file);
    onBusy(false);
    if (response.ok) router.refresh();
  }
  async function remove() {
    if (!window.confirm(copy.confirmMediaDelete)) return;
    onBusy(true);
    const response = await fetch("/api/roots/media", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entry_id: entry.entry_id }),
    });
    onBusy(false);
    if (response.ok) router.refresh();
  }
  return (
    <div className="roots-media-controls">
      {entry.media_available && (
        <a
          className="button button-secondary"
          href={`/api/roots/media?entry_id=${entry.entry_id}`}
          target="_blank"
          rel="noreferrer"
        >
          {entry.media_kind === "document" ? (
            <FileDown size={15} />
          ) : (
            <Eye size={15} />
          )}{" "}
          {copy.openMedia}
        </a>
      )}
      <label className="button button-secondary">
        <RefreshCw size={15} />{" "}
        {entry.media_available ? copy.replaceMedia : copy.addMedia}
        <input
          className="visually-hidden"
          type="file"
          disabled={busy}
          accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/mp4,video/mp4,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void replace(file);
          }}
        />
      </label>
      {entry.media_available && (
        <button
          className="button button-danger"
          disabled={busy}
          type="button"
          onClick={remove}
        >
          <Trash2 size={15} /> {copy.deleteMedia}
        </button>
      )}
    </div>
  );
}

export function RootsTimeline({
  entries,
  options,
  passportId,
  copy,
  locale,
}: {
  entries: RootsEntry[];
  options: RootsOptions;
  passportId: string;
  copy: RootsCopy;
  locale: Locale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function remove(entryId: string) {
    if (!window.confirm(copy.confirmEntryDelete)) return;
    setBusy(entryId);
    const response = await rootsAction({
      action: "delete_entry",
      entry_id: entryId,
    });
    setBusy(null);
    if (response.ok) router.refresh();
  }
  async function update(event: FormEvent<HTMLFormElement>, entryId: string) {
    event.preventDefault();
    setBusy(entryId);
    setError(null);
    const payload = entryPayload(new FormData(event.currentTarget));
    const response = await rootsAction({
      action: "update_entry",
      entry_id: entryId,
      ...payload,
    });
    setBusy(null);
    if (!response.ok) {
      setError(entryId);
      return;
    }
    setEditing(null);
    router.refresh();
  }
  if (!entries.length) return <p className="muted-copy">{copy.noEntries}</p>;
  return (
    <div className="roots-timeline">
      {entries.map((entry) => (
        <article className="roots-entry" key={entry.entry_id}>
          {editing === entry.entry_id ? (
            <form
              className="roots-form roots-edit-form"
              onSubmit={(event) => update(event, entry.entry_id)}
            >
              <EntryFields options={options} copy={copy} entry={entry} />
              {error === entry.entry_id && (
                <p className="form-error">{copy.actionError}</p>
              )}
              <div className="inline-actions">
                <button
                  className="button button-primary"
                  disabled={busy !== null}
                >
                  {copy.save}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  {copy.cancel}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="roots-entry-top">
                <div>
                  <h3>{entry.title}</h3>
                  <div className="roots-entry-meta">
                    <span>{copy.types[entry.type]}</span>
                    <span>{formatDate(locale, entry.occurred_at)}</span>
                    <span>
                      <LockKeyhole size={12} />{" "}
                      {copy.visibilityLabels[entry.visibility]}
                    </span>
                    {entry.culture_name && <span>{entry.culture_name}</span>}
                    {entry.language_name && <span>{entry.language_name}</span>}
                    {entry.mission_title && <span>{entry.mission_title}</span>}
                    {entry.event_title && <span>{entry.event_title}</span>}
                    {entry.village_name && <span>{entry.village_name}</span>}
                  </div>
                </div>
                <div className="roots-entry-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setEditing(entry.entry_id)}
                  >
                    <Pencil size={15} /> {copy.edit}
                  </button>
                  <button
                    className="button button-danger"
                    disabled={busy !== null}
                    type="button"
                    onClick={() => remove(entry.entry_id)}
                  >
                    <Trash2 size={15} /> {copy.delete}
                  </button>
                </div>
              </div>
              {entry.description && <p>{entry.description}</p>}
              <MediaControls
                entry={entry}
                passportId={passportId}
                copy={copy}
                busy={busy === entry.entry_id}
                onBusy={(value) => setBusy(value ? entry.entry_id : null)}
              />
            </>
          )}
        </article>
      ))}
    </div>
  );
}
