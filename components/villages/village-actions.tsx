"use client";

import { BellOff, BellRing, Flag, Send, Shield, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import type { ConnectionResult } from "@/features/connections/results";
import type { MessageResult } from "@/features/messaging/results";
import type {
  VillageMember,
  VillageReportResult,
} from "@/features/villages/results";
import type { Locale } from "@/lib/i18n/config";
import { getTrustCopy } from "@/features/trust/copy";
import type { VillageVerificationRequest } from "@/lib/validation/trust";
import { createClient } from "@/lib/supabase/browser";
import { reportReasons } from "@/lib/validation/messaging";
import { villageRoles, villageTypes } from "@/lib/validation/villages";
import { formatDateTime } from "@/lib/i18n/format";

export type VillageCopy = (typeof import("@/messages/en.json"))["villages"];

async function membershipAction(body: object) {
  return fetch("/api/villages/membership", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function AsyncButton({
  label,
  busyLabel,
  className = "button button-secondary",
  onAction,
}: {
  label: string;
  busyLabel: string;
  className?: string;
  onAction: () => Promise<Response>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <span className="village-action-wrap">
      <button
        className={className}
        disabled={busy}
        type="button"
        onClick={async () => {
          setBusy(true);
          setError(false);
          const response = await onAction();
          if (response.ok) router.refresh();
          else {
            setBusy(false);
            setError(true);
          }
        }}
      >
        {busy ? busyLabel : label}
      </button>
      {error && <small role="alert">!</small>}
    </span>
  );
}

export function CreateVillageForm({
  locale,
  countries,
  copy,
}: {
  locale: Locale;
  countries: { id: string; name: string }[];
  copy: VillageCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/villages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        village_type: String(form.get("village_type") ?? "local"),
        country_focus_id: String(form.get("country_focus_id") ?? "") || null,
        radius_km: Number(form.get("radius_km")),
        visibility: String(form.get("visibility") ?? "listed"),
        member_limit: Number(form.get("member_limit")),
      }),
    });
    const payload: unknown = await response.json().catch(() => null);
    const villageId =
      payload &&
      typeof payload === "object" &&
      "villageId" in payload &&
      typeof payload.villageId === "string"
        ? payload.villageId
        : null;
    if (response.ok && villageId)
      router.push(`/${locale}/app/villages/${villageId}`);
    else {
      setBusy(false);
      setError(true);
    }
  }
  return (
    <details className="village-create-panel">
      <summary>{copy.create}</summary>
      <form className="village-form" onSubmit={submit}>
        <label>
          {copy.name}
          <input name="name" minLength={3} maxLength={100} required />
        </label>
        <label>
          {copy.description}
          <textarea
            name="description"
            minLength={10}
            maxLength={1000}
            rows={4}
            required
          />
        </label>
        <div className="village-form-grid">
          <label>
            {copy.type}
            <select name="village_type" defaultValue="local">
              {villageTypes.map((type) => (
                <option key={type} value={type}>
                  {copy.types[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.countryFocus}
            <select name="country_focus_id" defaultValue="">
              <option value="">{copy.noCountryFocus}</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.radius}
            <input
              name="radius_km"
              type="number"
              min={5}
              max={100}
              defaultValue={40}
              required
            />
          </label>
          <label>
            {copy.memberLimit}
            <input
              name="member_limit"
              type="number"
              min={3}
              max={100}
              defaultValue={30}
              required
            />
          </label>
          <label>
            {copy.visibility}
            <select name="visibility" defaultValue="listed">
              <option value="listed">{copy.listed}</option>
              <option value="private">{copy.private}</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {copy.actionError}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? copy.creating : copy.createVillage}
        </button>
      </form>
    </details>
  );
}

export function RequestJoinButton({
  villageId,
  copy,
}: {
  villageId: string;
  copy: VillageCopy;
}) {
  return (
    <AsyncButton
      label={copy.requestJoin}
      busyLabel={copy.updating}
      onAction={() =>
        membershipAction({ action: "request", village_id: villageId })
      }
    />
  );
}

export function InvitationActions({
  villageId,
  copy,
}: {
  villageId: string;
  copy: VillageCopy;
}) {
  return (
    <div className="inline-actions">
      <AsyncButton
        label={copy.accept}
        busyLabel={copy.updating}
        className="button button-primary"
        onAction={() =>
          membershipAction({
            action: "respond_invitation",
            village_id: villageId,
            accept: true,
          })
        }
      />
      <AsyncButton
        label={copy.decline}
        busyLabel={copy.updating}
        onAction={() =>
          membershipAction({
            action: "respond_invitation",
            village_id: villageId,
            accept: false,
          })
        }
      />
    </div>
  );
}

export function InviteFamilyForm({
  villageId,
  connections,
  copy,
}: {
  villageId: string;
  connections: ConnectionResult[];
  copy: VillageCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const accepted = connections.filter(
    (connection) => connection.status === "accepted",
  );
  if (accepted.length === 0)
    return <p className="muted-copy">{copy.noFamiliesToInvite}</p>;
  return (
    <form
      className="invite-family-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(false);
        const familyId = String(
          new FormData(event.currentTarget).get("family_id") ?? "",
        );
        const response = await membershipAction({
          action: "invite",
          village_id: villageId,
          family_id: familyId,
        });
        if (response.ok) {
          setBusy(false);
          router.refresh();
        } else {
          setBusy(false);
          setError(true);
        }
      }}
    >
      <label>
        {copy.inviteConnected}
        <select name="family_id" required>
          {accepted.map((connection) => (
            <option
              key={connection.other_family_id}
              value={connection.other_family_id}
            >
              {connection.family_name}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-secondary" disabled={busy}>
        {busy ? copy.updating : copy.invite}
      </button>
      {error && <small role="alert">{copy.actionError}</small>}
    </form>
  );
}

export function JoinRequestActions({
  villageId,
  familyId,
  copy,
}: {
  villageId: string;
  familyId: string;
  copy: VillageCopy;
}) {
  return (
    <div className="inline-actions">
      <AsyncButton
        label={copy.accept}
        busyLabel={copy.updating}
        onAction={() =>
          membershipAction({
            action: "respond_request",
            village_id: villageId,
            family_id: familyId,
            accept: true,
          })
        }
      />
      <AsyncButton
        label={copy.decline}
        busyLabel={copy.updating}
        onAction={() =>
          membershipAction({
            action: "respond_request",
            village_id: villageId,
            family_id: familyId,
            accept: false,
          })
        }
      />
    </div>
  );
}

export function MemberControls({
  villageId,
  member,
  ownRole,
  copy,
}: {
  villageId: string;
  member: VillageMember;
  ownRole: string;
  copy: VillageCopy;
}) {
  if (member.is_current_family || member.role === "owner") return null;
  const canAssign = ownRole === "owner";
  const canRemove =
    ownRole === "owner" ||
    ((ownRole === "organizer" || ownRole === "moderator") &&
      member.role === "member");
  return (
    <div className="member-controls">
      {canAssign && (
        <label>
          {copy.role}
          <select
            value={member.role}
            onChange={async (event) => {
              await membershipAction({
                action: "set_role",
                village_id: villageId,
                family_id: member.family_id,
                role: event.target.value,
              });
              window.location.reload();
            }}
          >
            {villageRoles.map((role) => (
              <option key={role} value={role}>
                {copy.roles[role]}
              </option>
            ))}
          </select>
        </label>
      )}
      {canRemove && (
        <AsyncButton
          label={copy.removeMember}
          busyLabel={copy.updating}
          className="chat-tool danger"
          onAction={() =>
            membershipAction({
              action: "remove",
              village_id: villageId,
              family_id: member.family_id,
            })
          }
        />
      )}
    </div>
  );
}

export function LeaveVillageButton({
  villageId,
  isOwner,
  locale,
  copy,
}: {
  villageId: string;
  isOwner: boolean;
  locale: Locale;
  copy: VillageCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (isOwner)
    return <p className="owner-leave-note">{copy.transferBeforeLeaving}</p>;
  return (
    <button
      className="chat-tool danger"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await membershipAction({
          action: "leave",
          village_id: villageId,
        });
        if (response.ok) router.push(`/${locale}/app/villages`);
        else setBusy(false);
      }}
    >
      <UserMinus size={16} /> {busy ? copy.updating : copy.leave}
    </button>
  );
}

export function VillageMuteButton({
  villageId,
  muted,
  copy,
}: {
  villageId: string;
  muted: boolean;
  copy: VillageCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="chat-tool"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch("/api/villages/mute", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ village_id: villageId, muted: !muted }),
        });
        if (response.ok) router.refresh();
        else setBusy(false);
      }}
    >
      {muted ? <BellRing size={16} /> : <BellOff size={16} />}{" "}
      {busy ? copy.updating : muted ? copy.unmute : copy.mute}
    </button>
  );
}

export function VillageReportPanel({
  villageId,
  messageId,
  copy,
}: {
  villageId: string;
  messageId?: string;
  copy: VillageCopy;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  return (
    <details className="report-panel">
      <summary>
        <Flag size={15} /> {messageId ? copy.reportMessage : copy.reportVillage}
      </summary>
      {sent ? (
        <p role="status">{copy.reportSent}</p>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(false);
            const form = new FormData(event.currentTarget);
            const response = await fetch("/api/villages/reports", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                village_id: villageId,
                message_id: messageId ?? null,
                reason: String(form.get("reason")),
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
          }}
        >
          <label>
            {copy.reportReason}
            <select name="reason" defaultValue="harassment">
              {reportReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {copy.reasons[reason]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.reportDetails}
            <textarea name="details" maxLength={1000} rows={3} />
          </label>
          {error && <p className="form-error">{copy.actionError}</p>}
          <button className="button button-secondary" disabled={busy}>
            {busy ? copy.updating : copy.submitReport}
          </button>
        </form>
      )}
    </details>
  );
}

export function VillageChat({
  villageId,
  conversationId,
  messages,
  locale,
  copy,
}: {
  villageId: string;
  conversationId: string;
  messages: MessageResult[];
  locale: Locale;
  copy: VillageCopy;
}) {
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [live, setLive] = useState(false);
  const dateLocale =
    locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : "en-GB";
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`village-conversation:${conversationId}`)
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
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, router]);
  return (
    <>
      <p className="realtime-status" role="status">
        <span className={live ? "online" : ""} />
        {live ? copy.realtimeConnected : copy.realtimeConnecting}
      </p>
      <section className="message-thread village-thread" aria-live="polite">
        {messages.length === 0 && (
          <p className="empty-chat">{copy.emptyChat}</p>
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
              <VillageReportPanel
                villageId={villageId}
                messageId={message.message_id}
                copy={copy}
              />
            )}
          </article>
        ))}
        <div ref={endRef} />
      </section>
      <form
        className="message-composer"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!body.trim()) return;
          setBusy(true);
          setError(false);
          const response = await fetch("/api/villages/messages", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ village_id: villageId, body }),
          });
          if (response.ok) {
            setBody("");
            setBusy(false);
            router.refresh();
          } else {
            setBusy(false);
            setError(true);
          }
        }}
      >
        <label htmlFor="village-message-body">{copy.writeMessage}</label>
        <textarea
          id="village-message-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={3}
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

export function ModerationQueue({
  reports,
  copy,
  locale,
}: {
  reports: VillageReportResult[];
  copy: VillageCopy;
  locale: Locale;
}) {
  if (reports.length === 0)
    return <p className="muted-copy">{copy.noReports}</p>;
  return (
    <div className="moderation-list">
      {reports.map((report) => (
        <article key={report.report_id}>
          <Shield size={18} />
          <div>
            <span className={`moderation-severity ${report.severity}`}>
              {report.urgent_child_safety
                ? copy.urgentChildSafety
                : report.severity}
            </span>
            <strong>
              {copy.reasons[report.reason as keyof typeof copy.reasons] ??
                report.reason}
            </strong>
            <p>
              {report.target_event_title ??
                report.target_support_post_title ??
                report.target_family_name ??
                copy.villageTarget}
            </p>
            {report.details && <p>{report.details}</p>}
            <small>
              {copy.responseDue}{" "}
              {formatDateTime(locale, report.response_due_at)}
            </small>
            <div className="inline-actions">
              <AsyncButton
                label={copy.dismiss}
                busyLabel={copy.updating}
                onAction={() =>
                  fetch("/api/villages/reports", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      report_id: report.report_id,
                      resolution: "dismiss",
                    }),
                  })
                }
              />
              {report.target_message_id && (
                <AsyncButton
                  label={copy.deleteMessage}
                  busyLabel={copy.updating}
                  className="chat-tool danger"
                  onAction={() =>
                    fetch("/api/villages/reports", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        report_id: report.report_id,
                        resolution: "delete_message",
                      }),
                    })
                  }
                />
              )}
              {report.target_family_id && (
                <AsyncButton
                  label={copy.removeMember}
                  busyLabel={copy.updating}
                  className="chat-tool danger"
                  onAction={() =>
                    fetch("/api/villages/reports", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        report_id: report.report_id,
                        resolution: "remove_member",
                      }),
                    })
                  }
                />
              )}
              {report.target_event_id && (
                <>
                  <AsyncButton
                    label={copy.cancelReportedEvent}
                    busyLabel={copy.updating}
                    className="chat-tool danger"
                    onAction={() =>
                      fetch("/api/villages/reports", {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          report_id: report.report_id,
                          resolution: "cancel_event",
                        }),
                      })
                    }
                  />
                  <AsyncButton
                    label={copy.restrictReportedEvent}
                    busyLabel={copy.updating}
                    className="chat-tool danger"
                    onAction={() =>
                      fetch("/api/villages/reports", {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          report_id: report.report_id,
                          resolution: "restrict_event",
                        }),
                      })
                    }
                  />
                </>
              )}
              {report.target_support_post_id && (
                <AsyncButton
                  label={copy.deleteSupportContent}
                  busyLabel={copy.updating}
                  className="chat-tool danger"
                  onAction={() =>
                    fetch("/api/villages/reports", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        report_id: report.report_id,
                        resolution: "delete_support_content",
                      }),
                    })
                  }
                />
              )}
              <AsyncButton
                label={copy.escalateReport}
                busyLabel={copy.updating}
                onAction={() =>
                  fetch("/api/villages/reports", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      report_id: report.report_id,
                      resolution: "escalate",
                    }),
                  })
                }
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function VerificationQueue({
  requests,
  locale,
  copy,
}: {
  requests: VillageVerificationRequest[];
  locale: Locale;
  copy: VillageCopy;
}) {
  const trustCopy = getTrustCopy(locale);
  if (requests.length === 0)
    return <p className="muted-copy">{copy.noVerificationRequests}</p>;
  return (
    <div className="moderation-list verification-list">
      {requests.map((request) => (
        <article key={request.request_id}>
          <Shield size={18} />
          <div>
            <strong>{request.profile_display_name}</strong>
            <p>{request.family_name}</p>
            <p>{trustCopy.endorsementExact}</p>
            <AsyncButton
              label={trustCopy.endorse}
              busyLabel={trustCopy.endorseBusy}
              onAction={() =>
                fetch("/api/trust", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    action: "endorse_community_verification",
                    request_id: request.request_id,
                  }),
                })
              }
            />
          </div>
        </article>
      ))}
    </div>
  );
}
