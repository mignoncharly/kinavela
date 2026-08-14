import {
  ArrowLeft,
  CalendarDays,
  HandHelping,
  Languages,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import {
  InviteFamilyForm,
  JoinRequestActions,
  LeaveVillageButton,
  MemberControls,
  ModerationQueue,
  VillageChat,
  VillageMuteButton,
  VillageReportPanel,
  VerificationQueue,
} from "@/components/villages/village-actions";
import { EventBoard } from "@/components/events/event-board";
import { SupportBoard } from "@/components/villages/support-board";
import { InvitationLinkCreator } from "@/components/invitations/invitation-sharing";
import { parseEventMessages } from "@/features/playdates/results";
import { parseConnectionResults } from "@/features/connections/results";
import {
  parseEventAttendees,
  parseEventResults,
} from "@/features/events/results";
import { parseMessageResults } from "@/features/messaging/results";
import {
  parseVillageDetail,
  parseVillageMembers,
  parseVillageReports,
  parseVillageRequests,
} from "@/features/villages/results";
import { parseSupportPosts } from "@/features/villages/support-results";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { villageIdSchema } from "@/lib/validation/villages";
import { supportFilterSchema } from "@/lib/validation/support";
import { trustStatusSchema } from "@/lib/validation/trust";
import { villageVerificationRequestSchema } from "@/lib/validation/trust";

const tabs = [
  "overview",
  "families",
  "events",
  "support",
  "chat",
  "culture",
] as const;
type Tab = (typeof tabs)[number];

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; villageId: string }>;
  searchParams: Promise<{
    tab?: string;
    q?: string;
    category?: string;
    content_type?: string;
    status?: string;
  }>;
}) {
  const [{ locale, villageId: rawId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(locale)) notFound();
  const id = villageIdSchema.safeParse({ village_id: rawId });
  if (!id.success) notFound();
  const tab: Tab = tabs.includes(query.tab as Tab)
    ? (query.tab as Tab)
    : "overview";
  const parsedSupportFilters = supportFilterSchema.safeParse({
    ...(query.q ? { q: query.q } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.content_type ? { content_type: query.content_type } : {}),
    ...(query.status ? { status: query.status } : {}),
  });
  const supportFilters = parsedSupportFilters.success
    ? parsedSupportFilters.data
    : { status: "open" as const };
  const dictionary = getDictionary(locale);
  const copy = dictionary.villages;
  const eventCopy = dictionary.events;
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
  const detailResult = await supabase.rpc("get_village", {
    p_village_id: id.data.village_id,
  });
  const parsedDetail = parseVillageDetail(detailResult.data);
  if (detailResult.error || !parsedDetail.success) notFound();
  const village = parsedDetail.data[0];
  if (!village) notFound();
  const [
    membersResult,
    messagesResult,
    requestsResult,
    reportsResult,
    connectionsResult,
    eventsResult,
    trustResult,
    verificationRequestsResult,
    supportPostsResult,
  ] = await Promise.all([
    supabase.rpc("list_village_members", { p_village_id: village.village_id }),
    tab === "chat"
      ? supabase.rpc("list_village_messages", {
          p_village_id: village.village_id,
          p_before: null,
          p_limit: 100,
        })
      : Promise.resolve({ data: [], error: null }),
    village.can_moderate
      ? supabase.rpc("list_village_membership_requests", {
          p_village_id: village.village_id,
        })
      : Promise.resolve({ data: [], error: null }),
    village.can_moderate
      ? supabase.rpc("list_village_reports", {
          p_village_id: village.village_id,
        })
      : Promise.resolve({ data: [], error: null }),
    village.can_moderate
      ? supabase.rpc("list_family_connections")
      : Promise.resolve({ data: [], error: null }),
    tab === "events"
      ? supabase.rpc("list_village_events", {
          p_village_id: village.village_id,
        })
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("get_my_trust_status"),
    village.can_moderate
      ? supabase.rpc("list_village_verification_requests", {
          p_village_id: village.village_id,
        })
      : Promise.resolve({ data: [], error: null }),
    tab === "support"
      ? supabase.rpc("list_village_support_posts", {
          p_village_id: village.village_id,
          p_query: supportFilters.q ?? null,
          p_category: supportFilters.category ?? null,
          p_content_type: supportFilters.content_type ?? null,
          p_status: supportFilters.status,
          p_before: null,
          p_limit: 30,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const members = parseVillageMembers(membersResult.data);
  const messages = parseMessageResults(messagesResult.data);
  const requests = parseVillageRequests(requestsResult.data);
  const reports = parseVillageReports(reportsResult.data);
  const connections = parseConnectionResults(connectionsResult.data);
  const events = parseEventResults(eventsResult.data);
  const trustStatus = trustStatusSchema.safeParse(
    Array.isArray(trustResult.data) ? trustResult.data[0] : trustResult.data,
  );
  const verificationRequests = villageVerificationRequestSchema
    .array()
    .safeParse(verificationRequestsResult.data);
  const supportPosts = parseSupportPosts(supportPostsResult.data);
  if (
    !members.success ||
    !messages.success ||
    !requests.success ||
    !reports.success ||
    !connections.success ||
    !events.success ||
    !verificationRequests.success ||
    !supportPosts.success ||
    supportPostsResult.error ||
    eventsResult.error
  )
    notFound();
  const attendeeEntries = await Promise.all(
    events.data
      .filter((event) => event.can_manage)
      .map(async (event) => {
        const result = await supabase.rpc("list_event_attendees", {
          p_event_id: event.event_id,
        });
        const parsed = parseEventAttendees(result.data);
        if (result.error || !parsed.success) notFound();
        return [event.event_id, parsed.data] as const;
      }),
  );
  const attendeesByEvent = Object.fromEntries(attendeeEntries);
  const eventMessageEntries = await Promise.all(
    events.data.map(async (event) => {
      const result = await supabase.rpc("list_event_messages", {
        p_event_id: event.event_id,
        p_before: null,
        p_limit: 100,
      });
      const parsed = parseEventMessages(result.data);
      if (result.error || !parsed.success) notFound();
      return [event.event_id, [...parsed.data].reverse()] as const;
    }),
  );
  const eventMessagesByEvent = Object.fromEntries(eventMessageEntries);
  const href = (nextTab: Tab) =>
    `/${locale}/app/villages/${village.village_id}?tab=${nextTab}`;
  return (
    <main className="app-shell village-detail-page">
      <AppHeader active="villages" locale={locale} />
      <section className="village-heading">
        <Link className="back-link" href={`/${locale}/app/villages`}>
          <ArrowLeft size={17} /> {copy.back}
        </Link>
        <div>
          <p className="eyebrow">{copy.privateCommunity}</p>
          <h1>{village.name}</h1>
          <p>
            <MapPin size={16} /> {village.city} ·{" "}
            {copy.memberCount.replace("{count}", String(village.member_count))}
          </p>
        </div>
        <div className="chat-tools">
          <VillageMuteButton
            villageId={village.village_id}
            muted={village.muted}
            copy={copy}
          />
          <VillageReportPanel villageId={village.village_id} copy={copy} />
          <LeaveVillageButton
            villageId={village.village_id}
            isOwner={village.member_role === "owner"}
            locale={locale}
            copy={copy}
          />
        </div>
      </section>
      <nav className="village-tabs" aria-label={copy.sections}>
        {tabs.map((item) => (
          <Link
            aria-current={tab === item ? "page" : undefined}
            href={href(item)}
            key={item}
          >
            {item === "overview" && <ShieldCheck />}
            {item === "families" && <Users />}
            {item === "events" && <CalendarDays />}
            {item === "support" && <HandHelping />}
            {item === "chat" && <MessageCircle />}
            {item === "culture" && <Languages />}
            {copy.tabs[item]}
          </Link>
        ))}
      </nav>
      <section className="village-tab-panel">
        {tab === "overview" && (
          <>
            <h2>{copy.tabs.overview}</h2>
            <p className="village-description">{village.description}</p>
            <dl className="village-facts">
              <div>
                <dt>{copy.type}</dt>
                <dd>{copy.types[village.village_type]}</dd>
              </div>
              <div>
                <dt>{copy.countryFocus}</dt>
                <dd>{village.country_focus_name ?? copy.noCountryFocus}</dd>
              </div>
              <div>
                <dt>{copy.radius}</dt>
                <dd>{village.radius_km} km</dd>
              </div>
              <div>
                <dt>{copy.visibility}</dt>
                <dd>
                  {village.visibility === "listed" ? copy.listed : copy.private}
                </dd>
              </div>
              <div>
                <dt>{copy.yourRole}</dt>
                <dd>{copy.roles[village.member_role]}</dd>
              </div>
            </dl>
          </>
        )}
        {tab === "families" && (
          <>
            <h2>{copy.tabs.families}</h2>
            {village.can_moderate && (
              <section className="governance-panel">
                <h3>{copy.inviteFamily}</h3>
                <InviteFamilyForm
                  villageId={village.village_id}
                  connections={connections.data}
                  copy={copy}
                />
                <InvitationLinkCreator
                  locale={locale}
                  invitationKind="village"
                  villageId={village.village_id}
                  villageName={village.name}
                />
                <h3>{copy.joinRequests}</h3>
                {requests.data.length === 0 ? (
                  <p className="muted-copy">{copy.noRequests}</p>
                ) : (
                  requests.data.map((request) => (
                    <article className="request-row" key={request.family_id}>
                      <div>
                        <strong>{request.family_name}</strong>
                        <span>{request.city}</span>
                      </div>
                      <JoinRequestActions
                        villageId={village.village_id}
                        familyId={request.family_id}
                        copy={copy}
                      />
                    </article>
                  ))
                )}
                <h3>{copy.verificationRequests}</h3>
                <VerificationQueue
                  requests={verificationRequests.data}
                  locale={locale}
                  copy={copy}
                />
              </section>
            )}
            <div className="member-list">
              {members.data.map((member) => (
                <article key={member.family_id}>
                  <Users />
                  <div>
                    <strong>{member.family_name}</strong>
                    <span>
                      {member.city} · {copy.roles[member.role]}
                    </span>
                  </div>
                  <MemberControls
                    villageId={village.village_id}
                    member={member}
                    ownRole={village.member_role}
                    copy={copy}
                  />
                </article>
              ))}
            </div>
            {village.can_moderate && (
              <section className="governance-panel">
                <h3>{copy.moderation}</h3>
                <ModerationQueue
                  reports={reports.data}
                  locale={locale}
                  copy={copy}
                />
              </section>
            )}
          </>
        )}
        {tab === "events" && (
          <EventBoard
            villageId={village.village_id}
            events={events.data}
            attendeesByEvent={attendeesByEvent}
            messagesByEvent={eventMessagesByEvent}
            canCreate={["owner", "organizer"].includes(village.member_role)}
            canInvite={village.can_moderate}
            locale={locale}
            meetingSafetyAcknowledged={
              trustStatus.success &&
              trustStatus.data.meeting_safety_acknowledged
            }
            copy={eventCopy}
          />
        )}
        {tab === "support" && (
          <SupportBoard
            villageId={village.village_id}
            posts={supportPosts.data}
            filters={supportFilters}
            locale={locale}
          />
        )}
        {tab === "chat" && (
          <>
            <div className="village-chat-intro">
              <h2>{copy.tabs.chat}</h2>
              <p>{copy.chatSafety}</p>
            </div>
            <VillageChat
              villageId={village.village_id}
              conversationId={village.conversation_id}
              messages={[...messages.data].reverse()}
              locale={locale}
              copy={copy}
            />
          </>
        )}
        {tab === "culture" && (
          <div className="phase-empty">
            <Languages />
            <h2>{copy.tabs.culture}</h2>
            <p>
              {village.country_focus_name
                ? copy.cultureFocus.replace(
                    "{country}",
                    village.country_focus_name,
                  )
                : copy.noCultureFocus}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
