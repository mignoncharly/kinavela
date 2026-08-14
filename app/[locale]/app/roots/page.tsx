import { ArrowLeft, BookHeart, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import {
  RootsEntryForm,
  RootsPassportActions,
  RootsTimeline,
} from "@/components/roots/roots-passport";
import { getRootsCopy } from "@/features/roots/copy";
import { OfflineSnapshotButton } from "@/components/pwa/offline-data";
import {
  parseRootsEntries,
  parseRootsExports,
  parseRootsOptions,
  parseRootsPassports,
} from "@/features/roots/results";
import { isLocale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const copy = getRootsCopy(locale);
  const appCopy = getAppDictionary(locale);
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

  const passportsResult = await supabase.rpc("list_my_roots_passports");
  const passports = parseRootsPassports(passportsResult.data);
  if (passportsResult.error || !passports.success) {
    return (
      <main className="app-shell roots-page">
        <p className="form-error">{copy.unavailable}</p>
      </main>
    );
  }
  const selected =
    passports.data.find((passport) => passport.child_id === query.child) ??
    passports.data[0];
  const [entriesResult, optionsResult, exportsResult] = selected
    ? await Promise.all([
        supabase.rpc("list_roots_passport_entries_v2", {
          p_child_id: selected.child_id,
          p_locale: locale,
        }),
        supabase.rpc("get_roots_passport_options_v2", {
          p_child_id: selected.child_id,
          p_locale: locale,
        }),
        supabase.rpc("list_roots_passport_exports", {
          p_child_id: selected.child_id,
          p_locale: locale,
        }),
      ])
    : [
        { data: [], error: null },
        { data: null, error: null },
        { data: [], error: null },
      ];
  const entries = parseRootsEntries(entriesResult.data);
  const options = parseRootsOptions(optionsResult.data);
  const exports = parseRootsExports(exportsResult.data);
  return (
    <main className="app-shell roots-page">
      <AppHeader active="roots" locale={locale} />
      <section className="roots-hero">
        <Link className="back-link" href={`/${locale}/app`}>
          <ArrowLeft size={17} /> {copy.back}
        </Link>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </section>
      <div className="roots-layout">
        <aside className="roots-children">
          <h2>{copy.children}</h2>
          {passports.data.map((passport) => (
            <Link
              className="roots-child-link"
              aria-current={
                selected?.child_id === passport.child_id ? "page" : undefined
              }
              href={`/${locale}/app/roots?child=${passport.child_id}`}
              key={passport.child_id}
            >
              <strong>{passport.child_nickname}</strong>
              <small>
                {passport.entry_count} {copy.entries}
              </small>
            </Link>
          ))}
        </aside>
        <section className="roots-panel">
          {selected ? (
            <>
              <div className="roots-panel-heading">
                <div>
                  <h2>{selected.child_nickname}</h2>
                  <p>
                    <ShieldCheck size={15} /> {copy.privacy}
                  </p>
                </div>
                <RootsPassportActions
                  childId={selected.child_id}
                  copy={copy}
                  exports={exports.success ? exports.data : []}
                />
              </div>
              <OfflineSnapshotButton
                kind="passport"
                payload={{
                  passport: selected,
                  entries: entries.success ? entries.data : [],
                }}
                label={appCopy.pwa.savePassport}
                locale={locale}
              />
              <RootsEntryForm
                childId={selected.child_id}
                options={
                  options.success
                    ? options.data
                    : {
                        cultures: [],
                        languages: [],
                        missions: [],
                        villages: [],
                        events: [],
                      }
                }
                passportId={selected.passport_id}
                copy={copy}
              />
              {entries.success ? (
                <RootsTimeline
                  entries={entries.data}
                  options={
                    options.success
                      ? options.data
                      : {
                          cultures: [],
                          languages: [],
                          missions: [],
                          villages: [],
                          events: [],
                        }
                  }
                  passportId={selected.passport_id}
                  copy={copy}
                  locale={locale}
                />
              ) : (
                <p className="form-error">{copy.unavailable}</p>
              )}
            </>
          ) : (
            <div className="phase-empty">
              <BookHeart />
              <h2>{copy.children}</h2>
              <p>{copy.noEntries}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
