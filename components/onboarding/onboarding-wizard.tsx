"use client";

import { ArrowLeft, ArrowRight, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  CitySearch,
  type CitySearchCopy,
} from "@/components/discovery/city-search";
import type { Locale } from "@/lib/i18n/config";
import type { OnboardingDraft } from "@/lib/validation/onboarding";
import { getAppDictionary } from "@/lib/i18n/app-copy";
import { formatNumber } from "@/lib/i18n/format";

type Reference = { id: string; name: string };
type Interest = { id: string; name_key: string };
type Props = {
  locale: Locale;
  profileName: string;
  countries: (Reference & { iso2: string; emoji: string })[];
  cultures: Reference[];
  languages: Reference[];
  interests: Interest[];
  discoveryCopy: CitySearchCopy;
  inviteToken?: string;
  inviteContext?: { kind: "family_referral" | "village"; name?: string };
  initialDraft?: OnboardingDraft;
};
type Child = { id: number };
type Row = { id: number };
const sections = [[0, 1], [2, 3], [4, 5], [6, 7], [8], [9], [10]] as const;

const goals = [
  "language",
  "stories",
  "recipes",
  "traditions",
  "history",
  "music",
  "family_connections",
] as const;
const periods = ["morning", "afternoon", "evening"] as const;

export function OnboardingWizard({
  locale,
  profileName,
  countries,
  cultures,
  languages,
  interests,
  discoveryCopy,
  inviteToken,
  inviteContext,
  initialDraft,
}: Props) {
  const router = useRouter();
  const dictionary = getAppDictionary(locale);
  const t = dictionary.onboarding;
  const steps = t.steps;
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(initialDraft?.step ?? 0);
  const [children, setChildren] = useState<Child[]>(
    (initialDraft?.children ?? [1]).map((id) => ({ id })),
  );
  const [languageRows, setLanguageRows] = useState<Row[]>(
    (initialDraft?.languageRows ?? [1]).map((id) => ({ id })),
  );
  const [availabilityRows, setAvailabilityRows] = useState<Row[]>(
    (initialDraft?.availabilityRows ?? [1]).map((id) => ({ id })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [country, setCountry] = useState(
    String(initialDraft?.values.country ?? "DE"),
  );
  // Seeded from the draft rather than a bare 40, because the restore effect
  // below writes saved values straight onto the DOM controls without firing
  // React events — a resumed draft would otherwise show 40 next to a slider
  // sitting somewhere else entirely.
  const [radius, setRadius] = useState(() => {
    const saved = Number(initialDraft?.values.radius);
    return Number.isInteger(saved) && saved >= 5 && saved <= 100 ? saved : 40;
  });

  useEffect(() => {
    if (!initialDraft || !formRef.current) return;
    for (const [name, value] of Object.entries(initialDraft.values)) {
      // radius is React-controlled and seeded from the draft above. Writing to
      // it here would fight that: the browser clamps an out-of-range draft to
      // max, React does not re-render to correct it, and the readout ends up
      // disagreeing with both the thumb and the value that gets submitted.
      if (name === "radius") continue;
      const controls = formRef.current.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(`[name="${CSS.escape(name)}"]`);
      controls.forEach((control) => {
        if (
          control instanceof HTMLInputElement &&
          control.type === "checkbox"
        ) {
          control.checked = Array.isArray(value)
            ? value.includes(control.value)
            : value === control.value;
        } else if (!Array.isArray(value)) control.value = value;
      });
    }
  }, [initialDraft]);

  async function saveDraft(form: HTMLFormElement, nextStep: number) {
    const data = new FormData(form);
    const values: Record<string, string | string[]> = {};
    for (const [name, rawValue] of data.entries()) {
      const value = String(rawValue);
      const existing = values[name];
      values[name] =
        existing === undefined
          ? value
          : Array.isArray(existing)
            ? [...existing, value]
            : [existing, value];
    }
    for (const checkbox of form.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][name]`,
    )) {
      if (!data.has(checkbox.name)) values[checkbox.name] = [];
    }
    await fetch("/api/onboarding/draft", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: 1,
        step: nextStep,
        children: children.map(({ id }) => id),
        languageRows: languageRows.map(({ id }) => id),
        availabilityRows: availabilityRows.map(({ id }) => id),
        values,
      }),
    }).catch(() => undefined);
  }

  function next(form: HTMLFormElement) {
    for (const section of sections[step]!) {
      const invalid = form
        .querySelectorAll("fieldset")
        [section]?.querySelector<HTMLInputElement | HTMLSelectElement>(
          ":invalid",
        );
      if (invalid) return invalid.reportValidity();
    }
    const nextStep = Math.min(6, step + 1);
    void saveDraft(form, nextStep);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = (name: string) => form.getAll(name).map(String);
    const cultureIds = selected("cultures");
    const interestIds = selected("interests");
    const preservation = selected("preservation");
    const locationPlaceId = String(form.get("locationPlaceId") ?? "");
    if (!cultureIds.length || !interestIds.length || !preservation.length) {
      setError(t.selectRequired);
      return;
    }
    if (!locationPlaceId) {
      setStep(5);
      setError(t.locationRequired);
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      display_name: form.get("displayName"),
      preferred_language: locale,
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin",
      family: {
        name: form.get("familyName"),
        country_of_residence: form.get("country"),
        city: form.get("city"),
        location_place_id: locationPlaceId,
        radius_km: Number(form.get("radius")),
        visibility: form.get("visibility"),
        bio: form.get("bio"),
      },
      children: children.map((child) => ({
        nickname: form.get(`child-${child.id}-name`),
        birth_year: Number(form.get(`child-${child.id}-year`)),
        birth_month: form.get(`child-${child.id}-month`)
          ? Number(form.get(`child-${child.id}-month`))
          : null,
        gender: form.get(`child-${child.id}-gender`) || null,
      })),
      culture_ids: cultureIds,
      languages: languageRows.map((row) => ({
        language_id: form.get(`language-${row.id}`),
        proficiency: form.get(`proficiency-${row.id}`),
        transmission_goal: form.get(`languageGoal-${row.id}`),
      })),
      preservation_goals: preservation,
      interest_ids: interestIds,
      availability: availabilityRows.map((row) => ({
        weekday: Number(form.get(`weekday-${row.id}`)),
        period: form.get(`period-${row.id}`),
      })),
      preferences: {
        open_to_other_african_families: form.get("africanFamilies") === "on",
        open_to_all_diaspora_families: form.get("allDiaspora") === "on",
        min_child_age: Number(form.get("minAge")),
        max_child_age: Number(form.get("maxAge")),
      },
      accept_community_guidelines: form.get("guidelines") === "on",
    };
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "validation_failed");
      await fetch("/api/onboarding/draft", { method: "DELETE" }).catch(
        () => undefined,
      );
      router.push(
        inviteToken
          ? `/${locale}/invite/${inviteToken}`
          : `/${locale}/app?welcome=1`,
      );
      router.refresh();
    } catch (submissionError) {
      const code =
        submissionError instanceof Error
          ? submissionError.message
          : "validation_failed";
      setError(
        code === "invalid_location"
          ? discoveryCopy.invalidLocation
          : code === "germany_location_required"
            ? discoveryCopy.germanyOnly
            : code === "not_authenticated" || code === "email_not_verified"
              ? discoveryCopy.authenticationRequired
              : discoveryCopy.validationFailed,
      );
      setBusy(false);
    }
  }

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <span className="brand">
          <span className="brand-mark">K</span>
          <span>KINAVELA</span>
        </span>
        <span>
          {step + 1} / {steps.length}
        </span>
      </header>
      <div className="onboarding-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <nav className="onboarding-legal-links" aria-label={t.legal}>
        <Link href={"/" + locale + "/privacy"}>{t.privacy}</Link>{" "}
        <Link href={"/" + locale + "/terms"}>{t.terms}</Link>{" "}
        <Link href={"/" + locale + "/community-guidelines"}>{t.community}</Link>{" "}
        <Link href={"/" + locale + "/child-safety"}>{t.childSafety}</Link>
      </nav>
      <form ref={formRef} className="onboarding-card" onSubmit={submit}>
        {inviteContext && (
          <aside className="onboarding-invite" role="status">
            <strong>
              {inviteContext.kind === "village"
                ? t.inviteVillage.replace(
                    "{name}",
                    inviteContext.name ?? "Kinavela",
                  )
                : t.inviteFamily}
            </strong>
            <span>{t.inviteReturn}</span>
          </aside>
        )}
        <p className="eyebrow">{steps[step]}</p>
        <fieldset hidden={!sections[step]!.includes(0 as never)}>
          <legend>{t.welcomeTitle}</legend>
          <p>{t.welcomeBody}</p>
          <div className="privacy-notice">
            <ShieldCheck /> {t.exactAddress}
          </div>
        </fieldset>
        <fieldset hidden={!sections[step]!.includes(1 as never)}>
          <legend>{t.profileTitle}</legend>
          <label>
            {t.displayName}
            <input
              name="displayName"
              autoComplete="name"
              defaultValue={profileName}
              minLength={2}
              maxLength={80}
              required
            />
          </label>
          <p className="field-help">{t.profileHelp}</p>
        </fieldset>
        <fieldset hidden={!sections[step]!.includes(2 as never)}>
          <legend>{t.familyTitle}</legend>
          <label>
            {t.familyName}
            <input
              name="familyName"
              autoComplete="organization"
              placeholder={t.familyPlaceholder}
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <label>
            {t.familyBio}
            <textarea
              name="bio"
              maxLength={600}
              placeholder={t.bioPlaceholder}
            />
          </label>
        </fieldset>
        <fieldset hidden={!sections[step]!.includes(3 as never)}>
          <legend>{t.childrenTitle}</legend>
          {children.map((child, index) => (
            <div className="child-row" key={child.id}>
              <strong>{t.child.replace("{number}", String(index + 1))}</strong>
              <label>
                {t.nickname}
                <input
                  name={`child-${child.id}-name`}
                  autoComplete="off"
                  maxLength={40}
                  required
                />
              </label>
              <label>
                {t.birthYear}
                <input
                  name={`child-${child.id}-year`}
                  inputMode="numeric"
                  type="number"
                  min="2005"
                  max={new Date().getFullYear()}
                  required
                />
              </label>
              <label>
                {t.birthMonth}
                <input
                  name={`child-${child.id}-month`}
                  inputMode="numeric"
                  type="number"
                  min="1"
                  max="12"
                />
              </label>
              <label>
                {t.gender}
                <select name={`child-${child.id}-gender`} defaultValue="">
                  <option value="">{t.noGender}</option>
                  <option value="female">{t.girl}</option>
                  <option value="male">{t.boy}</option>
                  <option value="nonbinary">{t.nonbinary}</option>
                  <option value="prefer_not_to_say">{t.preferNot}</option>
                </select>
              </label>
              {children.length > 1 && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    setChildren((items) =>
                      items.filter((item) => item.id !== child.id),
                    )
                  }
                >
                  <Trash2 size={18} /> {dictionary.common.remove}
                </button>
              )}
            </div>
          ))}
          {children.length < 8 && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                setChildren((items) => [
                  ...items,
                  { id: Math.max(...items.map((item) => item.id)) + 1 },
                ])
              }
            >
              <Plus size={18} /> {t.addChild}
            </button>
          )}
        </fieldset>
        <fieldset hidden={!sections[step]!.includes(4 as never)}>
          <legend>{t.culturesTitle}</legend>
          <div className="choice-grid">
            {cultures.map((item) => (
              <label className="choice" key={item.id}>
                <input type="checkbox" name="cultures" value={item.id} />
                {item.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset hidden={!sections[step]!.includes(5 as never)}>
          <legend>{t.languagesTitle}</legend>
          <p className="field-help">{t.languagesHelp}</p>
          {languageRows.map((row, index) => (
            <div className="child-row compact-row" key={row.id}>
              <strong>
                {t.languageNumber.replace("{number}", String(index + 1))}
              </strong>
              <label>
                {t.mainLanguage}
                <select name={`language-${row.id}`} required defaultValue="">
                  <option value="" disabled>
                    {t.select}
                  </option>
                  {languages.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.currentLevel}
                <select
                  name={`proficiency-${row.id}`}
                  defaultValue="conversational"
                >
                  <option value="beginner">{t.beginner}</option>
                  <option value="conversational">{t.conversational}</option>
                  <option value="fluent">{t.fluent}</option>
                  <option value="native">{t.native}</option>
                </select>
              </label>
              <label>
                {t.languageGoal}
                <select
                  name={`languageGoal-${row.id}`}
                  defaultValue="want_to_teach_children"
                >
                  <option value="already_speaking">{t.alreadySpeaking}</option>
                  <option value="learning">{t.learning}</option>
                  <option value="want_to_teach_children">
                    {t.teachChildren}
                  </option>
                  <option value="cultural_interest">
                    {t.culturalInterest}
                  </option>
                </select>
              </label>
              {languageRows.length > 1 && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    setLanguageRows((items) =>
                      items.filter((item) => item.id !== row.id),
                    )
                  }
                >
                  <Trash2 size={18} /> {dictionary.common.remove}
                </button>
              )}
            </div>
          ))}
          {languageRows.length < 10 && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                setLanguageRows((items) => [
                  ...items,
                  { id: Math.max(...items.map((item) => item.id)) + 1 },
                ])
              }
            >
              <Plus size={18} /> {t.addLanguage}
            </button>
          )}
        </fieldset>
        <fieldset hidden={!sections[step]!.includes(6 as never)}>
          <legend>{t.preservationTitle}</legend>
          <div className="choice-grid">
            {goals.map((goal) => (
              <label className="choice" key={goal}>
                <input type="checkbox" name="preservation" value={goal} />
                {dictionary.reference.goals[goal]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset hidden={!sections[step]!.includes(7 as never)}>
          <legend>{t.interestsTitle}</legend>
          <div className="choice-grid">
            {interests.map((interest) => (
              <label className="choice" key={interest.id}>
                <input type="checkbox" name="interests" value={interest.id} />
                {
                  dictionary.reference.interests[
                    interest.name_key.replace(
                      "interests.",
                      "",
                    ) as keyof typeof dictionary.reference.interests
                  ]
                }
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset hidden={!sections[step]!.includes(8 as never)}>
          <legend>{t.availabilityTitle}</legend>
          <p className="field-help">{t.availabilityHelp}</p>
          {availabilityRows.map((row, index) => (
            <div className="child-row compact-row" key={row.id}>
              <strong>{t.slot.replace("{number}", String(index + 1))}</strong>
              <label>
                {t.day}
                <select name={`weekday-${row.id}`} defaultValue="6">
                  {dictionary.reference.weekdays.map((day, dayIndex) => (
                    <option value={dayIndex} key={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.time}
                <select name={`period-${row.id}`} defaultValue="afternoon">
                  {periods.map((period) => (
                    <option value={period} key={period}>
                      {dictionary.reference.periods[period]}
                    </option>
                  ))}
                </select>
              </label>
              {availabilityRows.length > 1 && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    setAvailabilityRows((items) =>
                      items.filter((item) => item.id !== row.id),
                    )
                  }
                >
                  <Trash2 size={18} /> {dictionary.common.remove}
                </button>
              )}
            </div>
          ))}
          {availabilityRows.length < 7 && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                setAvailabilityRows((items) => [
                  ...items,
                  { id: Math.max(...items.map((item) => item.id)) + 1 },
                ])
              }
            >
              <Plus size={18} /> {t.addAvailability}
            </button>
          )}
        </fieldset>
        <fieldset hidden={!sections[step]!.includes(9 as never)}>
          <legend>{t.discoveryTitle}</legend>
          <label>
            {t.country}
            <select
              name="country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              required
            >
              {countries
                .filter((item) => item.iso2 === "DE")
                .map((country) => (
                  <option value={country.iso2} key={country.id}>
                    {country.emoji} {country.name}
                  </option>
                ))}
            </select>
          </label>
          <CitySearch
            key={country}
            country={country}
            locale={locale}
            copy={discoveryCopy}
            initialSelection={
              typeof initialDraft?.values.locationPlaceId === "string" &&
              typeof initialDraft?.values.city === "string"
                ? {
                    placeId: initialDraft.values.locationPlaceId,
                    city: initialDraft.values.city,
                  }
                : undefined
            }
          />
          <p className="privacy-notice compact-notice">
            <ShieldCheck size={19} /> {t.locationPrivacy}
          </p>
          <label>
            {t.radius}:{" "}
            <output>
              {formatNumber(locale, radius)} {t.distanceUnit}
            </output>
            <input
              name="radius"
              type="range"
              min="5"
              max="100"
              step="5"
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
            />
          </label>
          <label>
            {t.visibility}
            <select name="visibility" defaultValue="discoverable">
              <option value="discoverable">{t.discoverable}</option>
              <option value="private">{t.private}</option>
            </select>
          </label>
          <label className="consent">
            <input name="africanFamilies" type="checkbox" defaultChecked />{" "}
            {t.africanFamilies}
          </label>
          <label className="consent">
            <input name="allDiaspora" type="checkbox" /> {t.diasporaFamilies}
          </label>
          <div className="two-columns">
            <label>
              {t.youngestAge}
              <input
                name="minAge"
                inputMode="numeric"
                type="number"
                min="0"
                max="20"
                defaultValue="0"
              />
            </label>
            <label>
              {t.oldestAge}
              <input
                name="maxAge"
                inputMode="numeric"
                type="number"
                min="0"
                max="20"
                defaultValue="18"
              />
            </label>
          </div>
        </fieldset>
        <fieldset hidden={!sections[step]!.includes(10 as never)}>
          <legend>{t.reviewTitle}</legend>
          <p>{t.reviewBody}</p>
          <div className="privacy-notice">
            <ShieldCheck /> {t.reviewPrivacy}
          </div>
          <label className="consent">
            <input name="guidelines" type="checkbox" required /> {t.guidelines}
          </label>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="wizard-actions">
          {step > 0 && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                const previous = step - 1;
                if (formRef.current) void saveDraft(formRef.current, previous);
                setStep(previous);
              }}
            >
              <ArrowLeft size={18} /> {dictionary.common.back}
            </button>
          )}
          {step < 6 ? (
            <button
              type="button"
              className="button button-primary"
              onClick={(event) => next(event.currentTarget.form!)}
            >
              {dictionary.common.continue} <ArrowRight size={18} />
            </button>
          ) : (
            <button
              type="submit"
              className="button button-primary"
              disabled={busy}
            >
              {busy ? t.creating : t.createFamily}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
