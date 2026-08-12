"use client";

import { Check, Handshake, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Copy = {
  connect: string;
  connecting: string;
  requested: string;
  connected: string;
  accept: string;
  decline: string;
  updating: string;
  actionError: string;
};

export function ConnectionRequestButton({
  familyId,
  state,
  copy,
}: {
  familyId: string;
  state?: "requested" | "accepted";
  copy: Copy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (state) {
    return (
      <span className="connection-state">
        <Handshake size={16} />
        {state === "accepted" ? copy.connected : copy.requested}
      </span>
    );
  }
  return (
    <div className="connection-action">
      <button
        type="button"
        className="button button-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          const response = await fetch("/api/connections", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ family_id: familyId }),
          });
          if (response.ok) router.refresh();
          else {
            setBusy(false);
            setError(true);
          }
        }}
      >
        <Handshake size={16} /> {busy ? copy.connecting : copy.connect}
      </button>
      {error && <small role="alert">{copy.actionError}</small>}
    </div>
  );
}

export function ConnectionResponseButtons({
  connectionId,
  copy,
}: {
  connectionId: string;
  copy: Copy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function respond(accept: boolean) {
    setBusy(true);
    setError(false);
    const response = await fetch(`/api/connections/${connectionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accept }),
    });
    if (response.ok) router.refresh();
    else {
      setBusy(false);
      setError(true);
    }
  }
  return (
    <div className="connection-response">
      <button
        type="button"
        className="button button-primary"
        disabled={busy}
        onClick={() => respond(true)}
      >
        <Check size={16} /> {busy ? copy.updating : copy.accept}
      </button>
      <button
        type="button"
        className="button button-secondary"
        disabled={busy}
        onClick={() => respond(false)}
      >
        <X size={16} /> {copy.decline}
      </button>
      {error && <small role="alert">{copy.actionError}</small>}
    </div>
  );
}

export function RealLifeMeetingButton({
  connectionId,
}: {
  connectionId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <button
      className="button button-secondary"
      type="button"
      disabled={busy || confirmed}
      onClick={async () => {
        setBusy(true);
        const response = await fetch(
          `/api/connections/${connectionId}/meeting`,
          {
            method: "POST",
          },
        );
        if (response.ok) setConfirmed(true);
        setBusy(false);
      }}
    >
      {confirmed ? "Meeting recorded" : busy ? "Saving…" : "We met in person"}
    </button>
  );
}

export function MarkNotificationRead({
  notificationId,
  label,
}: {
  notificationId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="notification-read"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch("/api/notifications/read", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notification_id: notificationId }),
        });
        if (response.ok) router.refresh();
        else setBusy(false);
      }}
    >
      {label}
    </button>
  );
}
