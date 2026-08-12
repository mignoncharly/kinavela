import { BellOff, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import { parseConversationResults } from "@/features/messaging/results";
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
  const copy = getDictionary(locale).messages;
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

  const [conversationsResult, unreadResult] = await Promise.all([
    supabase.rpc("list_family_conversations"),
    supabase.rpc("get_unread_message_count"),
  ]);
  const parsed = parseConversationResults(conversationsResult.data);
  const conversations = parsed.success ? parsed.data : [];
  const unreadTotal =
    typeof unreadResult.data === "number" && unreadResult.data >= 0
      ? unreadResult.data
      : 0;
  const unavailable =
    Boolean(conversationsResult.error) ||
    Boolean(unreadResult.error) ||
    !parsed.success;
  const dateLocale =
    locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : "en-GB";

  return (
    <main className="app-shell messages-page">
      <AppHeader active="messages" locale={locale} unreadCount={unreadTotal} />
      <section className="messages-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </section>
      {unavailable && (
        <p className="form-error" role="alert">
          {copy.unavailable}
        </p>
      )}
      {!unavailable && conversations.length === 0 ? (
        <section className="empty-discovery">
          <ShieldCheck />
          <p>{copy.noConversations}</p>
          <Link
            className="button button-primary"
            href={`/${locale}/app/connections`}
          >
            {copy.viewConnections}
          </Link>
        </section>
      ) : (
        <section className="conversation-list" aria-label={copy.title}>
          {conversations.map((conversation) => (
            <Link
              className={conversation.unread_count > 0 ? "unread" : ""}
              href={`/${locale}/app/messages/${conversation.conversation_id}`}
              key={conversation.conversation_id}
            >
              <span className="conversation-icon">
                <MessageCircle />
              </span>
              <span className="conversation-summary">
                <strong>{conversation.other_family_name}</strong>
                <span>
                  {conversation.last_message_preview ?? copy.startConversation}
                </span>
              </span>
              <span className="conversation-meta">
                {conversation.muted && (
                  <BellOff size={15} aria-label={copy.muted} />
                )}
                {conversation.last_message_at && (
                  <time dateTime={conversation.last_message_at}>
                    {new Intl.DateTimeFormat(dateLocale, {
                      dateStyle: "medium",
                    }).format(new Date(conversation.last_message_at))}
                  </time>
                )}
                {conversation.unread_count > 0 && (
                  <span className="unread-badge">
                    {conversation.unread_count}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
