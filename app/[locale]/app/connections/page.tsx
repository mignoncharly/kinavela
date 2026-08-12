import { Bell, Handshake, MapPin, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import {
  ConnectionResponseButtons,
  MarkNotificationRead,
  RealLifeMeetingButton,
} from "@/components/connections/connection-actions";
import { BlockFamilyButton } from "@/components/discovery/discovery-actions";
import { MessageFamilyButton } from "@/components/messaging/messaging-actions";
import {
  parseConnectionResults,
  parseNotificationResults,
} from "@/features/connections/results";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getDictionary(locale).connections;
  const messageCopy = getDictionary(locale).messages;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile?.onboarding_completed) redirect(`/${locale}/onboarding`);

  const [connectionsResult, notificationsResult] = await Promise.all([
    supabase.rpc("list_family_connections"),
    supabase.rpc("list_notifications", { p_limit: 30 }),
  ]);
  const parsedConnections = parseConnectionResults(connectionsResult.data);
  const parsedNotifications = parseNotificationResults(
    notificationsResult.data,
  );
  const connections = parsedConnections.success ? parsedConnections.data : [];
  const notifications = parsedNotifications.success
    ? parsedNotifications.data
    : [];
  const unavailable =
    Boolean(connectionsResult.error) ||
    Boolean(notificationsResult.error) ||
    !parsedConnections.success ||
    !parsedNotifications.success;
  const incoming = connections.filter(
    (item) => item.status === "requested" && item.direction === "incoming",
  );
  const outgoing = connections.filter(
    (item) => item.status === "requested" && item.direction === "outgoing",
  );
  const accepted = connections.filter((item) => item.status === "accepted");
  const dateLocale =
    locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : "en-GB";

  return (
    <main className="app-shell connections-page">
      <AppHeader active="connections" locale={locale} />

      <section className="connections-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </section>

      {unavailable && (
        <p className="form-error" role="alert">
          {copy.unavailable}
        </p>
      )}

      {notifications.length > 0 && (
        <section className="notification-panel">
          <h2>
            <Bell size={20} /> {copy.notifications}
          </h2>
          <ul>
            {notifications.map((item) => (
              <li
                className={item.read_at ? "" : "unread"}
                key={item.notification_id}
              >
                <span>
                  {(item.notification_type === "connection_request"
                    ? copy.notificationRequest
                    : item.notification_type === "connection_accepted"
                      ? copy.notificationAccepted
                      : copy.notificationMessage
                  ).replace("{family}", item.actor_family_name)}
                </span>
                {!item.read_at && (
                  <MarkNotificationRead
                    notificationId={item.notification_id}
                    label={copy.markRead}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {incoming.length > 0 && (
        <section className="connection-section">
          <h2>{copy.incoming}</h2>
          <div className="connection-grid">
            {incoming.map((item) => (
              <article className="connection-card" key={item.connection_id}>
                <h3>{item.family_name}</h3>
                <p className="area">
                  <MapPin size={16} /> {item.display_city} · {item.country_code}
                </p>
                <p>{copy.pendingPrivacy}</p>
                <ConnectionResponseButtons
                  connectionId={item.connection_id}
                  copy={copy}
                />
                <BlockFamilyButton
                  familyId={item.other_family_id}
                  copy={copy}
                />
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="connection-section">
        <h2>{copy.connectedFamilies}</h2>
        {accepted.length === 0 ? (
          <div className="empty-discovery">
            <ShieldCheck />
            <p>{copy.noConnections}</p>
            <Link
              className="button button-primary"
              href={`/${locale}/app/discover`}
            >
              {copy.findFamilies}
            </Link>
          </div>
        ) : (
          <div className="connection-grid">
            {accepted.map((item) => (
              <article
                className="connection-card accepted"
                key={item.connection_id}
              >
                <div>
                  <span className="connection-state">
                    <Handshake size={16} /> {copy.connected}
                  </span>
                  <h3>{item.family_name}</h3>
                  <p className="area">
                    <MapPin size={16} /> {item.display_city} ·{" "}
                    {item.country_code}
                  </p>
                </div>
                {item.bio && <p>{item.bio}</p>}
                {item.guardian_names.length > 0 && (
                  <p className="guardian-names">
                    <UserRound size={16} /> {copy.guardians}:{" "}
                    {item.guardian_names.join(", ")}
                  </p>
                )}
                <p className="privacy-note">{copy.acceptedPrivacy}</p>
                <MessageFamilyButton
                  familyId={item.other_family_id}
                  locale={locale}
                  copy={messageCopy}
                />
                <RealLifeMeetingButton connectionId={item.connection_id} />
                <BlockFamilyButton
                  familyId={item.other_family_id}
                  copy={copy}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="connection-section">
          <h2>{copy.outgoing}</h2>
          <ul className="outgoing-list">
            {outgoing.map((item) => (
              <li key={item.connection_id}>
                <span>{item.family_name}</span>
                <time dateTime={item.requested_at}>
                  {new Intl.DateTimeFormat(dateLocale, {
                    dateStyle: "medium",
                  }).format(new Date(item.requested_at))}
                </time>
                <span className="connection-state">{copy.requested}</span>
                <BlockFamilyButton
                  familyId={item.other_family_id}
                  copy={copy}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
