import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import {
  BlockConversationFamilyButton,
  ChatThread,
  MuteConversationButton,
  ReportPanel,
} from "@/components/messaging/messaging-actions";
import {
  parseConversationResults,
  parseMessageResults,
} from "@/features/messaging/results";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { conversationReadSchema } from "@/lib/validation/messaging";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; conversationId: string }>;
}) {
  const { locale, conversationId: rawConversationId } = await params;
  if (!isLocale(locale)) notFound();
  const idResult = conversationReadSchema.safeParse({
    conversation_id: rawConversationId,
  });
  if (!idResult.success) notFound();
  const conversationId = idResult.data.conversation_id;
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

  const [conversationsResult, messagesResult] = await Promise.all([
    supabase.rpc("list_family_conversations"),
    supabase.rpc("list_conversation_messages", {
      p_conversation_id: conversationId,
      p_before: null,
      p_limit: 100,
    }),
  ]);
  const parsedConversations = parseConversationResults(
    conversationsResult.data,
  );
  const parsedMessages = parseMessageResults(messagesResult.data);
  if (
    conversationsResult.error ||
    messagesResult.error ||
    !parsedConversations.success ||
    !parsedMessages.success
  ) {
    notFound();
  }
  const conversation = parsedConversations.data.find(
    (item) => item.conversation_id === conversationId,
  );
  if (!conversation) notFound();
  const messages = [...parsedMessages.data].reverse();

  return (
    <main className="app-shell chat-page">
      <AppHeader active="messages" locale={locale} />
      <section className="chat-heading">
        <Link className="back-link" href={`/${locale}/app/messages`}>
          <ArrowLeft size={17} /> {copy.back}
        </Link>
        <div>
          <p className="eyebrow">{copy.privateConversation}</p>
          <h1>{conversation.other_family_name}</h1>
          <p>
            <ShieldCheck size={16} /> {copy.safetyNote}
          </p>
        </div>
        <div className="chat-tools">
          <MuteConversationButton
            conversationId={conversationId}
            muted={conversation.muted}
            copy={copy}
          />
          <ReportPanel
            targetType="family"
            targetId={conversation.other_family_id}
            copy={copy}
          />
          <BlockConversationFamilyButton
            familyId={conversation.other_family_id}
            locale={locale}
            copy={copy}
          />
        </div>
      </section>
      <ChatThread
        conversationId={conversationId}
        messages={messages}
        locale={locale}
        copy={copy}
      />
    </main>
  );
}
