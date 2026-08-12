"use client";

import {
  BellOff,
  BellRing,
  Flag,
  MessageCircle,
  Send,
  ShieldX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import type { MessageResult } from "@/features/messaging/results";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/browser";
import { reportReasons } from "@/lib/validation/messaging";

type ReportReason = (typeof reportReasons)[number];

export type MessagingCopy = {
  messageFamily: string;
  opening: string;
  actionError: string;
  writeMessage: string;
  messagePlaceholder: string;
  send: string;
  sending: string;
  emptyConversation: string;
  realtimeConnected: string;
  realtimeConnecting: string;
  mute: string;
  unmute: string;
  muting: string;
  report: string;
  reportFamily: string;
  reportMessage: string;
  reportReason: string;
  reportDetails: string;
  reportDetailsPlaceholder: string;
  submitReport: string;
  reporting: string;
  reportSent: string;
  block: string;
  blocking: string;
  reasons: Record<ReportReason, string>;
};

export function MessageFamilyButton({
  familyId,
  locale,
  copy,
}: {
  familyId: string;
  locale: Locale;
  copy: MessagingCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="message-family-action">
      <button
        type="button"
        className="button button-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          const response = await fetch("/api/messages/conversations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ family_id: familyId }),
          });
          const payload: unknown = await response.json().catch(() => null);
          const conversationId =
            payload &&
            typeof payload === "object" &&
            "conversationId" in payload &&
            typeof payload.conversationId === "string"
              ? payload.conversationId
              : null;
          if (response.ok && conversationId) {
            router.push(`/${locale}/app/messages/${conversationId}`);
          } else {
            setBusy(false);
            setError(true);
          }
        }}
      >
        <MessageCircle size={16} /> {busy ? copy.opening : copy.messageFamily}
      </button>
      {error && <small role="alert">{copy.actionError}</small>}
    </div>
  );
}

export function MuteConversationButton({
  conversationId,
  muted,
  copy,
}: {
  conversationId: string;
  muted: boolean;
  copy: MessagingCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="chat-tool"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch("/api/messages/mute", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            muted: !muted,
          }),
        });
        if (response.ok) router.refresh();
        else setBusy(false);
      }}
    >
      {muted ? <BellRing size={16} /> : <BellOff size={16} />}
      {busy ? copy.muting : muted ? copy.unmute : copy.mute}
    </button>
  );
}

export function ReportPanel({
  targetType,
  targetId,
  copy,
}: {
  targetType: "family" | "message";
  targetId: string;
  copy: MessagingCopy;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        reason: String(form.get("reason") ?? ""),
        details: String(form.get("details") ?? ""),
      }),
    });
    if (response.ok) {
      setSent(true);
      setBusy(false);
    } else {
      setError(true);
      setBusy(false);
    }
  }
  return (
    <details className="report-panel" ref={detailsRef}>
      <summary>
        <Flag size={15} />{" "}
        {targetType === "family" ? copy.reportFamily : copy.reportMessage}
      </summary>
      {sent ? (
        <p role="status">{copy.reportSent}</p>
      ) : (
        <form onSubmit={submit}>
          <label>
            {copy.reportReason}
            <select name="reason" required defaultValue="harassment">
              {reportReasons.map((reason) => (
                <option value={reason} key={reason}>
                  {copy.reasons[reason]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.reportDetails}
            <textarea
              name="details"
              maxLength={1000}
              rows={3}
              placeholder={copy.reportDetailsPlaceholder}
            />
          </label>
          {error && <p className="form-error">{copy.actionError}</p>}
          <button className="button button-secondary" disabled={busy}>
            {busy ? copy.reporting : copy.submitReport}
          </button>
        </form>
      )}
    </details>
  );
}

export function BlockConversationFamilyButton({
  familyId,
  locale,
  copy,
}: {
  familyId: string;
  locale: Locale;
  copy: MessagingCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="chat-tool danger"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch("/api/discovery/block", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ family_id: familyId, blocked: true }),
        });
        if (response.ok) router.push(`/${locale}/app/messages`);
        else setBusy(false);
      }}
    >
      <ShieldX size={16} /> {busy ? copy.blocking : copy.block}
    </button>
  );
}

export function ChatThread({
  conversationId,
  messages,
  locale,
  copy,
}: {
  conversationId: string;
  messages: MessageResult[];
  locale: Locale;
  copy: MessagingCopy;
}) {
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const dateLocale =
    locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : "en-GB";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    void fetch("/api/messages/read", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId }),
    });
  }, [conversationId, messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`family-conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => router.refresh(),
      )
      .subscribe((status) => setRealtimeReady(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, router]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(false);
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, body }),
    });
    if (response.ok) {
      setBody("");
      setBusy(false);
      router.refresh();
    } else {
      setBusy(false);
      setError(true);
    }
  }

  return (
    <>
      <p className="realtime-status" role="status">
        <span className={realtimeReady ? "online" : ""} />
        {realtimeReady ? copy.realtimeConnected : copy.realtimeConnecting}
      </p>
      <section
        className="message-thread"
        aria-live="polite"
        aria-label={copy.writeMessage}
      >
        {messages.length === 0 && (
          <p className="empty-chat">{copy.emptyConversation}</p>
        )}
        {messages.map((message) => (
          <article
            className={`message-bubble ${message.is_own_family ? "own" : "received"}`}
            key={message.message_id}
          >
            <header>
              <strong>{message.sender_display_name}</strong>
              <time dateTime={message.created_at}>
                {new Intl.DateTimeFormat(dateLocale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(message.created_at))}
              </time>
            </header>
            <p>{message.body}</p>
            {!message.is_own_family && (
              <ReportPanel
                targetType="message"
                targetId={message.message_id}
                copy={copy}
              />
            )}
          </article>
        ))}
        <div ref={endRef} />
      </section>
      <form className="message-composer" onSubmit={send}>
        <label htmlFor="message-body">{copy.writeMessage}</label>
        <textarea
          id="message-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={copy.messagePlaceholder}
          required
        />
        <div>
          <small>{body.length}/2000</small>
          <button
            className="button button-primary"
            disabled={busy || !body.trim()}
          >
            <Send size={16} /> {busy ? copy.sending : copy.send}
          </button>
        </div>
        {error && <p className="form-error">{copy.actionError}</p>}
      </form>
    </>
  );
}
