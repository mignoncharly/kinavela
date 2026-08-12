import { notFound } from "next/navigation";

import { AnonymousStoryRecorder } from "@/components/stories/story-actions";
import { getStoriesCopy } from "@/features/stories/copy";
import { parseStoryRecord } from "@/features/stories/results";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { hashStoryToken } from "@/lib/security/story-token";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (!isLocale(locale) || token.length < 30) notFound();
  const copy = getStoriesCopy(locale);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_story_request_by_token", {
    p_token_hash: hashStoryToken(token),
  });
  const record = parseStoryRecord(data);
  if (error || !record.success || !record.data[0])
    return (
      <main className="app-shell stories-page">
        <section className="story-recorder">
          <h1>{copy.invalidLink}</h1>
        </section>
      </main>
    );
  return (
    <main className="stories-page">
      <AnonymousStoryRecorder copy={copy} token={token} />
    </main>
  );
}
