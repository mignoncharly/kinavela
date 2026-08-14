"use client";

import { Copy, Mail, Share2, Smartphone, XCircle } from "lucide-react";
import { useState } from "react";

import { getInvitationCopy } from "@/features/invitations/copy";
import { publicEnv } from "@/lib/env.public";
import type { Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/format";

const appUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

type ShareProps = {
  locale: Locale;
  text: string;
  url: string;
};

export function SafeShareButtons({ locale, text, url }: ShareProps) {
  const copy = getInvitationCopy(locale);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const message = `${text}\n${url}`;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kinavela", text, url });
        setError(false);
        return;
      }
      await copyUrl();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError")
        return;
      setError(true);
    }
  }

  return (
    <div className="invitation-share-actions">
      <a
        className="button button-primary"
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        rel="noreferrer"
        target="_blank"
      >
        <Smartphone size={17} /> {copy.whatsapp}
      </a>
      <button
        className="button button-secondary"
        type="button"
        onClick={() => void share()}
      >
        <Share2 size={17} /> {copy.nativeShare}
      </button>
      <button
        className="button button-secondary"
        type="button"
        onClick={() => void copyUrl()}
      >
        <Copy size={17} /> {copy.copyLink}
      </button>
      <a
        className="button button-secondary"
        href={`mailto:?subject=${encodeURIComponent("Kinavela")}&body=${encodeURIComponent(message)}`}
      >
        <Mail size={17} /> {copy.email}
      </a>
      {copied && (
        <span className="form-success" role="status">
          {copy.copied}
        </span>
      )}
      {error && (
        <span className="form-error" role="alert">
          {copy.shareFailed}
        </span>
      )}
    </div>
  );
}

type CreatorProps = {
  locale: Locale;
  invitationKind: "family_referral" | "village";
  villageId?: string;
  villageName?: string;
  eventId?: string;
  eventTitle?: string;
};

type CreatedInvitation = {
  invitation_id: string;
  raw_token: string;
  expires_at: string;
};

export function InvitationLinkCreator({
  locale,
  invitationKind,
  villageId,
  villageName,
  eventId,
  eventTitle,
}: CreatorProps) {
  const copy = getInvitationCopy(locale);
  const [invitation, setInvitation] = useState<CreatedInvitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const title = eventId
    ? copy.eventTitle
    : invitationKind === "village"
      ? copy.villageTitle
      : copy.generalTitle;
  const body = eventId
    ? copy.eventBody
    : invitationKind === "village"
      ? copy.villageBody
      : copy.generalBody;
  const shareText = eventTitle
    ? copy.eventShare.replace("{event}", eventTitle)
    : villageName
      ? copy.villageShare.replace("{village}", villageName)
      : copy.referralShare;

  async function createLink() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          invitation_kind: invitationKind,
          village_id: villageId ?? null,
          event_id: eventId ?? null,
          locale,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        invitation?: CreatedInvitation;
      };
      if (!response.ok || !result.ok || !result.invitation)
        throw new Error("create_failed");
      setInvitation(result.invitation);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!invitation) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "revoke",
          invitation_id: invitation.invitation_id,
        }),
      });
      if (!response.ok) throw new Error("revoke_failed");
      setInvitation(null);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const invitationUrl = invitation
    ? `${appUrl}/${locale}/invite/${invitation.raw_token}`
    : null;

  return (
    <section className="invitation-creator">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h3>{title}</h3>
        <p>{body}</p>
        <small>{copy.privacy}</small>
      </div>
      {!invitation || !invitationUrl ? (
        <button
          className="button button-secondary"
          disabled={busy}
          type="button"
          onClick={() => void createLink()}
        >
          <Share2 size={17} /> {busy ? copy.creating : copy.create}
        </button>
      ) : (
        <div className="invitation-created">
          <SafeShareButtons
            locale={locale}
            text={shareText}
            url={invitationUrl}
          />
          <p>
            {copy.expires.replace(
              "{date}",
              formatDate(locale, invitation.expires_at),
            )}
          </p>
          <button
            className="button danger-button"
            disabled={busy}
            type="button"
            onClick={() => void revoke()}
          >
            <XCircle size={17} /> {busy ? copy.revoking : copy.revoke}
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {copy.actionError}
        </p>
      )}
    </section>
  );
}

export function InternalEventShare({
  locale,
  villageId,
  eventId,
  eventTitle,
}: {
  locale: Locale;
  villageId: string;
  eventId: string;
  eventTitle: string;
}) {
  const copy = getInvitationCopy(locale);
  const url = `${appUrl}/${locale}/app/villages/${villageId}?tab=events#event-${eventId}`;
  return (
    <section className="event-internal-share">
      <strong>{copy.internalEventShare}</strong>
      <p>{copy.internalEventBody}</p>
      <SafeShareButtons
        locale={locale}
        text={copy.eventShare.replace("{event}", eventTitle)}
        url={url}
      />
    </section>
  );
}
