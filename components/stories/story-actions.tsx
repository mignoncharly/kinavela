"use client";

import { Check, Copy, Mic, Square, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

import type { StoriesCopy } from "@/features/stories/copy";
import type { FamilyStory, StoryRequest } from "@/lib/validation/stories";
import { storyLanguages } from "@/lib/validation/stories";
import type { RootsPassport } from "@/lib/validation/roots";

async function action(body: object) {
  return fetch("/api/stories/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function StoryRequestForm({
  passports,
  copy,
  locale,
}: {
  passports: RootsPassport[];
  copy: StoriesCopy;
  locale: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const data = new FormData(event.currentTarget);
    const response = await action({
      action: "create_request",
      child_id: String(data.get("child_id")),
      question: String(data.get("question")),
      requested_translation_language: String(data.get("translation")) || null,
      request_adaptation: data.get("adaptation") === "on",
    });
    const payload = (await response.json().catch(() => null)) as {
      request?: { access_token?: string };
    } | null;
    if (!response.ok || !payload?.request?.access_token) {
      setBusy(false);
      setError(true);
      return;
    }
    setLink(
      `${window.location.origin}/${locale}/stories/record/${payload.request.access_token}`,
    );
    setBusy(false);
    event.currentTarget.reset();
    router.refresh();
  }
  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div>
      <form className="story-form" onSubmit={submit}>
        <label>
          {copy.child}
          <select name="child_id" required>
            {passports.map((child) => (
              <option key={child.child_id} value={child.child_id}>
                {child.child_nickname}
              </option>
            ))}
          </select>
        </label>
        <label>
          {copy.question}
          <textarea
            name="question"
            placeholder={copy.questionPlaceholder}
            minLength={10}
            maxLength={2000}
            required
          />
        </label>
        <label>
          {copy.translation}
          <select name="translation" defaultValue="">
            <option value="">{copy.noTranslation}</option>
            {storyLanguages.map((language) => (
              <option key={language} value={language}>
                {language.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            <input name="adaptation" type="checkbox" defaultChecked />{" "}
            {copy.adaptation}
          </span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {copy.actionError}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? copy.creating : copy.createLink}
        </button>
      </form>
      {link && (
        <div className="story-link-box" style={{ marginTop: 14 }}>
          <input aria-label={copy.linkReady} readOnly value={link} />
          <button
            className="button button-secondary"
            type="button"
            onClick={copyLink}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
            {copied ? copy.copied : copy.copyLink}
          </button>
        </div>
      )}
    </div>
  );
}

export function StoryRequestList({
  requests,
  copy,
}: {
  requests: StoryRequest[];
  copy: StoriesCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function revoke(requestId: string) {
    setBusy(requestId);
    const response = await action({
      action: "revoke_request",
      request_id: requestId,
    });
    setBusy(null);
    if (response.ok) router.refresh();
  }
  return (
    <div>
      {requests.length === 0 ? (
        <p className="story-muted">{copy.noRequests}</p>
      ) : (
        requests.map((request) => (
          <article className="story-request-card" key={request.request_id}>
            <h3>{request.child_nickname}</h3>
            <p className="story-text">{request.question}</p>
            <div className="story-request-meta">
              <span>
                {request.status === "active"
                  ? copy.pending
                  : copy[request.status]}
              </span>
              <span>
                {copy.expires}:{" "}
                {new Date(request.expires_at).toLocaleDateString()}
              </span>
            </div>
            {request.status === "active" && (
              <button
                className="button button-secondary"
                disabled={busy !== null}
                type="button"
                onClick={() => revoke(request.request_id)}
              >
                {busy === request.request_id ? copy.revoking : copy.revoke}
              </button>
            )}
          </article>
        ))
      )}
    </div>
  );
}

export function StoryReviewList({
  stories,
  copy,
}: {
  stories: FamilyStory[];
  copy: StoriesCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function review(storyId: string, approval: "approved" | "rejected") {
    setBusy(storyId);
    const response = await action({
      action: "review",
      story_id: storyId,
      approval,
      adapted_story: null,
    });
    setBusy(null);
    if (response.ok) router.refresh();
  }
  async function addRoots(storyId: string) {
    setBusy(storyId);
    const response = await action({
      action: "add_to_roots",
      story_id: storyId,
      visibility: "private",
    });
    setBusy(null);
    if (response.ok) router.refresh();
  }
  return (
    <div>
      {stories.length === 0 ? (
        <p className="story-muted">{copy.noStories}</p>
      ) : (
        stories.map((story) => (
          <article className="story-card" key={story.story_id}>
            <h3>
              {story.title} · {story.child_nickname}
            </h3>
            <div className="story-status">
              <span>
                {story.ai_status === "ready" ? copy.ready : copy.processing}
              </span>
              <span>
                {story.approval_status === "approved"
                  ? copy.types.approved
                  : story.approval_status === "rejected"
                    ? copy.types.rejected
                    : copy.review}
              </span>
            </div>
            {story.audio_available && (
              <a
                className="button button-secondary"
                href={`/api/stories/audio/${story.story_id}`}
              >
                <Volume2 size={15} /> {copy.audio}
              </a>
            )}
            {story.transcript_original && (
              <details>
                <summary>{copy.transcript}</summary>
                <p className="story-text">{story.transcript_original}</p>
              </details>
            )}
            {story.transcript_translation && (
              <details>
                <summary>{copy.translationText}</summary>
                <p className="story-text">{story.transcript_translation}</p>
              </details>
            )}
            {story.adapted_story && (
              <details open>
                <summary>{copy.adaptationText}</summary>
                <p className="story-text">{story.adapted_story}</p>
              </details>
            )}
            <div className="inline-actions">
              {story.ai_status === "ready" &&
                story.approval_status === "pending_review" && (
                  <>
                    <button
                      className="button button-primary"
                      disabled={busy !== null}
                      type="button"
                      onClick={() => review(story.story_id, "approved")}
                    >
                      <Check size={15} /> {copy.approve}
                    </button>
                    <button
                      className="button button-secondary"
                      disabled={busy !== null}
                      type="button"
                      onClick={() => review(story.story_id, "rejected")}
                    >
                      {copy.reject}
                    </button>
                  </>
                )}
              {story.approval_status === "approved" &&
                !story.roots_entry_id && (
                  <button
                    className="button button-secondary"
                    disabled={busy !== null}
                    type="button"
                    onClick={() => addRoots(story.story_id)}
                  >
                    {copy.addRoots}
                  </button>
                )}
              {story.roots_entry_id && (
                <small className="story-muted">{copy.added}</small>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

export function AnonymousStoryRecorder({
  token,
  copy,
}: {
  token: string;
  copy: StoriesCopy;
}) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  async function start() {
    setError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunks.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setBlob(
          new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" }),
        );
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError(true);
    }
  }
  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const chosen = blob
      ? new File([blob], "story.webm", { type: blob.type })
      : file instanceof File && file.size
        ? file
        : null;
    if (!chosen) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    const upload = new FormData();
    upload.set("token", token);
    upload.set("title", String(form.get("title")));
    upload.set("original_language", String(form.get("language")));
    upload.set("file", chosen);
    const response = await fetch("/api/stories/anonymous", {
      method: "POST",
      body: upload,
    });
    setBusy(false);
    if (!response.ok) {
      setError(true);
      return;
    }
    setSent(true);
  }
  if (sent)
    return (
      <section className="story-recorder">
        <h1>{copy.recordTitle}</h1>
        <p>{copy.submittedBody}</p>
      </section>
    );
  return (
    <section className="story-recorder">
      <Mic aria-hidden="true" />
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.recordTitle}</h1>
      <p>{copy.recordIntro}</p>
      <form className="story-form" onSubmit={send}>
        <label>
          {copy.titleLabel}
          <input
            name="title"
            defaultValue="A family story"
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label>
          {copy.originalLanguage}
          <select name="language" defaultValue="en">
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
        {recording && <span className="recording-indicator">Recording</span>}
        {blob && <audio controls src={URL.createObjectURL(blob)} />}
        {error && (
          <p className="form-error" role="alert">
            {copy.actionError}
          </p>
        )}
        <div className="story-recorder-controls">
          {!recording ? (
            <button
              className="button button-primary"
              type="button"
              onClick={start}
            >
              <Mic size={16} /> {copy.record}
            </button>
          ) : (
            <button
              className="button button-secondary"
              type="button"
              onClick={stop}
            >
              <Square size={15} /> {copy.stop}
            </button>
          )}
          <label className="button button-secondary">
            {copy.file}
            <input
              name="file"
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/webm"
              hidden
            />
          </label>
          <button
            className="button button-primary"
            disabled={busy || recording}
          >
            {busy ? copy.uploading : copy.upload}
          </button>
        </div>
      </form>
    </section>
  );
}
