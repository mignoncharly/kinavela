import { ArrowLeft, BookOpen, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import {
  StoryRequestForm,
  StoryRequestList,
  StoryReviewList,
} from "@/components/stories/story-actions";
import { getStoriesCopy } from "@/features/stories/copy";
import {
  parseFamilyStories,
  parseStoryRequests,
} from "@/features/stories/results";
import { parseRootsPassports } from "@/features/roots/results";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getStoriesCopy(locale);
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
  const [childrenResult, requestsResult, storiesResult] = await Promise.all([
    supabase.rpc("list_my_roots_passports"),
    supabase.rpc("list_my_story_requests"),
    supabase.rpc("list_my_family_stories"),
  ]);
  const children = parseRootsPassports(childrenResult.data);
  const requests = parseStoryRequests(requestsResult.data);
  const stories = parseFamilyStories(storiesResult.data);
  return (
    <main className="app-shell stories-page">
      <AppHeader active="stories" locale={locale} />
      <section className="stories-hero">
        <Link className="back-link" href={`/${locale}/app`}>
          <ArrowLeft size={17} /> {copy.back}
        </Link>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </section>
      <section className="stories-grid">
        <article className="story-panel">
          <h2>{copy.create}</h2>
          <p className="story-muted">
            <ShieldCheck size={15} /> {copy.privacy}
          </p>
          {children.success && children.data.length > 0 ? (
            <StoryRequestForm
              passports={children.data}
              copy={copy}
              locale={locale}
            />
          ) : (
            <p className="story-muted">{copy.noRequests}</p>
          )}
        </article>
        <article className="story-panel">
          <h2>{copy.requests}</h2>
          {requestsResult.error || !requests.success ? (
            <p className="form-error">{copy.actionError}</p>
          ) : (
            <StoryRequestList copy={copy} requests={requests.data} />
          )}
        </article>
      </section>
      <section className="story-panel" style={{ marginTop: 24 }}>
        <h2>
          <BookOpen size={20} /> {copy.stories}
        </h2>
        {storiesResult.error || !stories.success ? (
          <p className="form-error">{copy.actionError}</p>
        ) : (
          <StoryReviewList copy={copy} stories={stories.data} />
        )}
      </section>
    </main>
  );
}
