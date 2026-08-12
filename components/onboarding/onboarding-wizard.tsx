"use client";

import { ArrowLeft, ArrowRight, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  CitySearch,
  type CitySearchCopy,
} from "@/components/discovery/city-search";
import type { Locale } from "@/lib/i18n/config";

type Reference = { id: string; name: string };
type Interest = { id: string; slug: string };
type Props = {
  locale: Locale;
  profileName: string;
  countries: (Reference & { iso2: string; emoji: string })[];
  cultures: Reference[];
  languages: Reference[];
  interests: Interest[];
  discoveryCopy: CitySearchCopy;
};
type Child = { id: number };

const steps = [
  "Welcome",
  "Your profile",
  "Your family",
  "Children",
  "Origins",
  "Languages",
  "Preservation",
  "Interests",
  "Availability",
  "Discovery",
  "Review",
];
const goals = [
  "language",
  "stories",
  "recipes",
  "traditions",
  "history",
  "music",
  "family_connections",
];
const periods = ["morning", "afternoon", "evening"];

export function OnboardingWizard({
  locale,
  profileName,
  countries,
  cultures,
  languages,
  interests,
  discoveryCopy,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [children, setChildren] = useState<Child[]>([{ id: 1 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [country, setCountry] = useState("DE");

  function next(form: HTMLFormElement) {
    const fieldset = form.querySelectorAll("fieldset")[step];
    const invalid = fieldset?.querySelector<
      HTMLInputElement | HTMLSelectElement
    >(":invalid");
    if (invalid) return invalid.reportValidity();
    setStep((value) => Math.min(10, value + 1));
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
      setError(
        "Please select at least one origin, preservation goal and interest.",
      );
      return;
    }
    if (!locationPlaceId) {
      setStep(9);
      setError("Please search for and select an approximate city area.");
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
      languages: [
        {
          language_id: form.get("language"),
          proficiency: form.get("proficiency"),
          transmission_goal: form.get("languageGoal"),
        },
      ],
      preservation_goals: preservation,
      interest_ids: interestIds,
      availability: [
        { weekday: Number(form.get("weekday")), period: form.get("period") },
      ],
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
      if (!response.ok) throw new Error("failed");
      router.push(`/${locale}/app?welcome=1`);
      router.refresh();
    } catch {
      setError(
        "We could not save your family. Please review your details and try again.",
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
      <nav className="onboarding-legal-links" aria-label="Legal">
        <Link href={"/" + locale + "/privacy"}>Privacy</Link>{" "}
        <Link href={"/" + locale + "/terms"}>Terms</Link>{" "}
        <Link href={"/" + locale + "/community-guidelines"}>Community</Link>{" "}
        <Link href={"/" + locale + "/child-safety"}>Child safety</Link>
      </nav>
      <form className="onboarding-card" onSubmit={submit}>
        <p className="eyebrow">{steps[step]}</p>
        <fieldset hidden={step !== 0}>
          <legend>Build a safe home for your family’s roots</legend>
          <p>
            Kinavela helps your family preserve culture and discover trusted
            community. Your children remain private and we show only approximate
            location information.
          </p>
          <div className="privacy-notice">
            <ShieldCheck /> Exact addresses are never requested or published.
          </div>
        </fieldset>
        <fieldset hidden={step !== 1}>
          <legend>Tell us about you</legend>
          <label>
            Display name
            <input
              name="displayName"
              defaultValue={profileName}
              minLength={2}
              maxLength={80}
              required
            />
          </label>
          <p className="field-help">
            This is visible only to approved family connections.
          </p>
        </fieldset>
        <fieldset hidden={step !== 2}>
          <legend>Create your family profile</legend>
          <label>
            Family name
            <input
              name="familyName"
              placeholder="The Nkom family"
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <label>
            About your family
            <textarea
              name="bio"
              maxLength={600}
              placeholder="Languages, traditions and what brings you here…"
            />
          </label>
        </fieldset>
        <fieldset hidden={step !== 3}>
          <legend>Add your children privately</legend>
          {children.map((child, index) => (
            <div className="child-row" key={child.id}>
              <strong>Child {index + 1}</strong>
              <label>
                Nickname
                <input
                  name={`child-${child.id}-name`}
                  maxLength={40}
                  required
                />
              </label>
              <label>
                Birth year
                <input
                  name={`child-${child.id}-year`}
                  type="number"
                  min="2005"
                  max={new Date().getFullYear()}
                  required
                />
              </label>
              <label>
                Birth month (optional)
                <input
                  name={`child-${child.id}-month`}
                  type="number"
                  min="1"
                  max="12"
                />
              </label>
              <label>
                Gender (optional)
                <select name={`child-${child.id}-gender`} defaultValue="">
                  <option value="">Prefer not to add</option>
                  <option value="female">Girl</option>
                  <option value="male">Boy</option>
                  <option value="nonbinary">Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
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
                  <Trash2 size={18} /> Remove
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
              <Plus size={18} /> Add child
            </button>
          )}
        </fieldset>
        <fieldset hidden={step !== 4}>
          <legend>Which cultures form your roots?</legend>
          <div className="choice-grid">
            {cultures.map((item) => (
              <label className="choice" key={item.id}>
                <input type="checkbox" name="cultures" value={item.id} />
                {item.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset hidden={step !== 5}>
          <legend>Languages in your family</legend>
          <label>
            Main language
            <select name="language" required defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              {languages.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Current level
            <select name="proficiency" defaultValue="conversational">
              <option value="beginner">Beginner</option>
              <option value="conversational">Conversational</option>
              <option value="fluent">Fluent</option>
              <option value="native">Native</option>
            </select>
          </label>
          <label>
            Your goal
            <select name="languageGoal" defaultValue="want_to_teach_children">
              <option value="already_speaking">Already speaking</option>
              <option value="learning">Learning</option>
              <option value="want_to_teach_children">Teach our children</option>
              <option value="cultural_interest">Cultural interest</option>
            </select>
          </label>
        </fieldset>
        <fieldset hidden={step !== 6}>
          <legend>What should live on?</legend>
          <div className="choice-grid">
            {goals.map((goal) => (
              <label className="choice" key={goal}>
                <input type="checkbox" name="preservation" value={goal} />
                {goal.replaceAll("_", " ")}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset hidden={step !== 7}>
          <legend>What would your family enjoy?</legend>
          <div className="choice-grid">
            {interests.map((interest) => (
              <label className="choice" key={interest.id}>
                <input type="checkbox" name="interests" value={interest.id} />
                {interest.slug.replaceAll("-", " ")}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset hidden={step !== 8}>
          <legend>When are you usually available?</legend>
          <label>
            Day
            <select name="weekday" defaultValue="6">
              {[
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ].map((day, index) => (
                <option value={index} key={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time
            <select name="period" defaultValue="afternoon">
              {periods.map((period) => (
                <option key={period}>{period}</option>
              ))}
            </select>
          </label>
        </fieldset>
        <fieldset hidden={step !== 9}>
          <legend>Set your discovery boundaries</legend>
          <label>
            Country
            <select
              name="country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              required
            >
              {countries.map((country) => (
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
          />
          <label>
            Search radius: <output>40 km</output>
            <input
              name="radius"
              type="range"
              min="5"
              max="100"
              step="5"
              defaultValue="40"
            />
          </label>
          <label>
            Visibility
            <select name="visibility" defaultValue="discoverable">
              <option value="discoverable">
                Discoverable by compatible families
              </option>
              <option value="private">Private—not shown in discovery</option>
            </select>
          </label>
          <label className="consent">
            <input name="africanFamilies" type="checkbox" defaultChecked /> Open
            to other African families
          </label>
          <label className="consent">
            <input name="allDiaspora" type="checkbox" /> Open to all diaspora
            families
          </label>
          <div className="two-columns">
            <label>
              Youngest child age
              <input
                name="minAge"
                type="number"
                min="0"
                max="20"
                defaultValue="0"
              />
            </label>
            <label>
              Oldest child age
              <input
                name="maxAge"
                type="number"
                min="0"
                max="20"
                defaultValue="18"
              />
            </label>
          </div>
        </fieldset>
        <fieldset hidden={step !== 10}>
          <legend>Your family is ready to take root</legend>
          <p>
            We’ll create a private family profile using your choices. You can
            change visibility and discovery preferences at any time.
          </p>
          <div className="privacy-notice">
            <ShieldCheck /> Child details are accessible only to your family.
            Nearby families never receive an exact address.
          </div>
          <label className="consent">
            <input name="guidelines" type="checkbox" required /> I accept the
            community guidelines and commit to respectful, child-safe
            participation.
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
              onClick={() => setStep((value) => value - 1)}
            >
              <ArrowLeft size={18} /> Back
            </button>
          )}
          {step < 10 ? (
            <button
              type="button"
              className="button button-primary"
              onClick={(event) => next(event.currentTarget.form!)}
            >
              Continue <ArrowRight size={18} />
            </button>
          ) : (
            <button
              type="submit"
              className="button button-primary"
              disabled={busy}
            >
              {busy ? "Creating…" : "Create family"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
