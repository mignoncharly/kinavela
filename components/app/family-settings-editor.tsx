"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import type { FamilySettingsInput } from "@/lib/validation/family-settings";
import type { Locale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";

type Reference = { id: string; name: string };
type Interest = { id: string; name_key: string };

const preservationGoals = [
  "language",
  "stories",
  "recipes",
  "traditions",
  "history",
  "music",
  "family_connections",
] as const;
const periods = ["morning", "afternoon", "evening"] as const;

function replaceAt<T>(items: T[], index: number, item: T) {
  return items.map((current, currentIndex) =>
    currentIndex === index ? item : current,
  );
}

export function FamilySettingsEditor({
  initial,
  cultures,
  languages,
  interests,
  locale,
}: {
  initial: FamilySettingsInput;
  cultures: Reference[];
  languages: Reference[];
  interests: Interest[];
  locale: Locale;
}) {
  const dictionary = getAppDictionary(locale);
  const t = dictionary.familySettings;
  const [settings, setSettings] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function removeChild(index: number) {
    if (settings.children.length === 1) {
      setError(t.keepChild);
      return;
    }
    const child = settings.children[index];
    if (!child) return;
    if (
      !window.confirm(
        t.removeConfirm.replace(
          "{name}",
          child.nickname || t.child.replace("{number}", ""),
        ),
      )
    ) {
      return;
    }
    setError("");
    setSettings((current) => ({
      ...current,
      children: current.children.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function addCulture() {
    const available = cultures.find(
      (item) =>
        !settings.cultures.some((culture) => culture.culture_id === item.id),
    );
    if (!available || settings.cultures.length >= 8) return;
    setSettings((current) => ({
      ...current,
      cultures: [
        ...current.cultures,
        {
          culture_id: available.id,
          relationship_type: "heritage",
          priority: 3,
        },
      ],
    }));
  }

  function addLanguage() {
    const available = languages.find(
      (item) =>
        !settings.languages.some(
          (language) => language.language_id === item.id,
        ),
    );
    if (!available || settings.languages.length >= 10) return;
    setSettings((current) => ({
      ...current,
      languages: [
        ...current.languages,
        {
          language_id: available.id,
          proficiency: "conversational",
          transmission_goal: "want_to_teach_children",
        },
      ],
    }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/family/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(
          body.error === "child_has_cultural_history"
            ? t.protectedChild
            : body.error === "owner_required"
              ? t.ownerRequired
              : t.invalid,
        );
        return;
      }
      setMessage(t.saved);
    } catch {
      setError(t.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="family-settings-editor" onSubmit={save}>
      <section className="family-settings-section">
        <p className="eyebrow">{t.familyEyebrow}</p>
        <h2>{t.familyTitle}</h2>
        <div className="two-columns">
          <label>
            {t.familyName}
            <input
              value={settings.family.name}
              minLength={2}
              maxLength={100}
              required
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  family: { ...current.family, name: event.target.value },
                }))
              }
            />
          </label>
          <label>
            {t.visibility}
            <select
              value={settings.family.visibility}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  family: {
                    ...current.family,
                    visibility: event.target.value as
                      "private" | "discoverable",
                  },
                }))
              }
            >
              <option value="discoverable">{t.discoverable}</option>
              <option value="private">{t.private}</option>
            </select>
          </label>
        </div>
        <label>
          {t.bio}
          <textarea
            value={settings.family.bio}
            maxLength={600}
            rows={4}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                family: { ...current.family, bio: event.target.value },
              }))
            }
          />
        </label>
      </section>

      <section className="family-settings-section">
        <p className="eyebrow">{t.childrenEyebrow}</p>
        <h2>{t.childrenTitle}</h2>
        <p className="field-help">{t.childrenHelp}</p>
        {settings.children.map((child, index) => (
          <div className="child-row" key={child.id ?? `new-${index}`}>
            <strong>{t.child.replace("{number}", String(index + 1))}</strong>
            <label>
              {t.nickname}
              <input
                value={child.nickname}
                minLength={1}
                maxLength={40}
                required
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    children: replaceAt(current.children, index, {
                      ...child,
                      nickname: event.target.value,
                    }),
                  }))
                }
              />
            </label>
            <label>
              {t.birthYear}
              <input
                type="number"
                min={2005}
                max={new Date().getFullYear()}
                value={child.birth_year}
                required
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    children: replaceAt(current.children, index, {
                      ...child,
                      birth_year: Number(event.target.value),
                    }),
                  }))
                }
              />
            </label>
            <label>
              {t.birthMonth}
              <input
                type="number"
                min={1}
                max={12}
                value={child.birth_month ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    children: replaceAt(current.children, index, {
                      ...child,
                      birth_month: event.target.value
                        ? Number(event.target.value)
                        : null,
                    }),
                  }))
                }
              />
            </label>
            <label>
              {t.gender}
              <select
                value={child.gender ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    children: replaceAt(current.children, index, {
                      ...child,
                      gender: (event.target.value ||
                        null) as typeof child.gender,
                    }),
                  }))
                }
              >
                <option value="">{t.noGender}</option>
                <option value="female">{t.girl}</option>
                <option value="male">{t.boy}</option>
                <option value="nonbinary">{t.nonbinary}</option>
                <option value="prefer_not_to_say">{t.preferNot}</option>
              </select>
            </label>
            <label>
              {t.identityVisibility}
              <select
                value={child.visibility}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    children: replaceAt(current.children, index, {
                      ...child,
                      visibility: event.target.value as typeof child.visibility,
                    }),
                  }))
                }
              >
                <option value="guardians">{t.guardiansOnly}</option>
                <option value="connections">{t.connections}</option>
              </select>
            </label>
            <button
              type="button"
              className="icon-button"
              onClick={() => removeChild(index)}
            >
              <Trash2 size={17} /> {t.removeChild}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button-secondary"
          disabled={settings.children.length >= 8}
          onClick={() =>
            setSettings((current) => ({
              ...current,
              children: [
                ...current.children,
                {
                  id: null,
                  nickname: "",
                  birth_year: new Date().getFullYear(),
                  birth_month: null,
                  gender: null,
                  visibility: "guardians",
                },
              ],
            }))
          }
        >
          <Plus size={17} /> {t.addChild}
        </button>
      </section>

      <section className="family-settings-section">
        <p className="eyebrow">{t.rootsEyebrow}</p>
        <h2>{t.rootsTitle}</h2>
        {settings.cultures.map((culture, index) => (
          <div className="family-settings-row" key={culture.culture_id}>
            <label>
              {t.culture}
              <select
                value={culture.culture_id}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    cultures: replaceAt(current.cultures, index, {
                      ...culture,
                      culture_id: event.target.value,
                    }),
                  }))
                }
              >
                {cultures.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={settings.cultures.some(
                      (selected, selectedIndex) =>
                        selectedIndex !== index &&
                        selected.culture_id === item.id,
                    )}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.relationship}
              <select
                value={culture.relationship_type}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    cultures: replaceAt(current.cultures, index, {
                      ...culture,
                      relationship_type: event.target
                        .value as typeof culture.relationship_type,
                    }),
                  }))
                }
              >
                <option value="origin">{t.origin}</option>
                <option value="heritage">{t.heritage}</option>
                <option value="connection">{t.familyConnection}</option>
                <option value="interest">{t.culturalInterest}</option>
              </select>
            </label>
            <label>
              {t.importance}: {culture.priority}/5
              <input
                type="range"
                min={1}
                max={5}
                value={culture.priority}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    cultures: replaceAt(current.cultures, index, {
                      ...culture,
                      priority: Number(event.target.value),
                    }),
                  }))
                }
              />
            </label>
            <button
              type="button"
              className="icon-button"
              disabled={settings.cultures.length === 1}
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  cultures: current.cultures.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                }))
              }
            >
              <Trash2 size={17} /> {dictionary.common.remove}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button-secondary"
          onClick={addCulture}
          disabled={
            settings.cultures.length >= 8 ||
            settings.cultures.length >= cultures.length
          }
        >
          <Plus size={17} /> {t.addCulture}
        </button>
        <h3>{t.liveOn}</h3>
        <div className="choice-grid">
          {preservationGoals.map((goal) => (
            <label className="choice" key={goal}>
              <input
                type="checkbox"
                checked={settings.preservation_goals.includes(goal)}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    preservation_goals: event.target.checked
                      ? [...current.preservation_goals, goal]
                      : current.preservation_goals.filter(
                          (selected) => selected !== goal,
                        ),
                  }))
                }
              />
              {dictionary.reference.goals[goal]}
            </label>
          ))}
        </div>
      </section>

      <section className="family-settings-section">
        <p className="eyebrow">{t.languagesEyebrow}</p>
        <h2>{t.languagesTitle}</h2>
        <p className="field-help">{t.languagesHelp}</p>
        {settings.languages.map((language, index) => (
          <div className="family-settings-row" key={language.language_id}>
            <label>
              {t.language}
              <select
                value={language.language_id}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    languages: replaceAt(current.languages, index, {
                      ...language,
                      language_id: event.target.value,
                    }),
                  }))
                }
              >
                {languages.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={settings.languages.some(
                      (selected, selectedIndex) =>
                        selectedIndex !== index &&
                        selected.language_id === item.id,
                    )}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.proficiency}
              <select
                value={language.proficiency}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    languages: replaceAt(current.languages, index, {
                      ...language,
                      proficiency: event.target
                        .value as typeof language.proficiency,
                    }),
                  }))
                }
              >
                <option value="beginner">{t.beginner}</option>
                <option value="conversational">{t.conversational}</option>
                <option value="fluent">{t.fluent}</option>
                <option value="native">{t.native}</option>
              </select>
            </label>
            <label>
              {t.transmissionGoal}
              <select
                value={language.transmission_goal}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    languages: replaceAt(current.languages, index, {
                      ...language,
                      transmission_goal: event.target
                        .value as typeof language.transmission_goal,
                    }),
                  }))
                }
              >
                <option value="already_speaking">{t.alreadySpeaking}</option>
                <option value="learning">{t.learning}</option>
                <option value="want_to_teach_children">
                  {t.teachChildren}
                </option>
                <option value="cultural_interest">{t.culturalInterest}</option>
              </select>
            </label>
            <button
              type="button"
              className="icon-button"
              disabled={settings.languages.length === 1}
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  languages: current.languages.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                }))
              }
            >
              <Trash2 size={17} /> {dictionary.common.remove}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button-secondary"
          onClick={addLanguage}
          disabled={
            settings.languages.length >= 10 ||
            settings.languages.length >= languages.length
          }
        >
          <Plus size={17} /> {t.addLanguage}
        </button>
      </section>

      <section className="family-settings-section">
        <p className="eyebrow">{t.interestsEyebrow}</p>
        <h2>{t.interestsTitle}</h2>
        <div className="choice-grid">
          {interests.map((interest) => (
            <label className="choice" key={interest.id}>
              <input
                type="checkbox"
                checked={settings.interest_ids.includes(interest.id)}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    interest_ids: event.target.checked
                      ? [...current.interest_ids, interest.id]
                      : current.interest_ids.filter(
                          (selected) => selected !== interest.id,
                        ),
                  }))
                }
              />
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
      </section>

      <section className="family-settings-section">
        <p className="eyebrow">{t.availabilityEyebrow}</p>
        <h2>{t.availabilityTitle}</h2>
        <div className="availability-grid">
          {dictionary.reference.weekdays.map((day, weekday) => (
            <fieldset key={day}>
              <legend>{day}</legend>
              {periods.map((period) => {
                const selected = settings.availability.some(
                  (slot) => slot.weekday === weekday && slot.period === period,
                );
                return (
                  <label key={period}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          availability: event.target.checked
                            ? [...current.availability, { weekday, period }]
                            : current.availability.filter(
                                (slot) =>
                                  slot.weekday !== weekday ||
                                  slot.period !== period,
                              ),
                        }))
                      }
                    />
                    {dictionary.reference.periods[period]}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      </section>

      <section className="family-settings-section">
        <p className="eyebrow">{t.matchingEyebrow}</p>
        <h2>{t.matchingTitle}</h2>
        <div className="priority-grid">
          {(
            [
              ["same_country_priority", t.priorities.same_country_priority],
              ["same_culture_priority", t.priorities.same_culture_priority],
              [
                "similar_child_age_priority",
                t.priorities.similar_child_age_priority,
              ],
              ["same_language_priority", t.priorities.same_language_priority],
              [
                "shared_interests_priority",
                t.priorities.shared_interests_priority,
              ],
              ["availability_priority", t.priorities.availability_priority],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}: {settings.preferences[key]}/5
              <input
                type="range"
                min={0}
                max={5}
                value={settings.preferences[key]}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    preferences: {
                      ...current.preferences,
                      [key]: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
          ))}
        </div>
        <div className="two-columns">
          <label>
            {t.youngestAge}
            <input
              type="number"
              min={0}
              max={20}
              value={settings.preferences.min_child_age}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    min_child_age: Number(event.target.value),
                  },
                }))
              }
            />
          </label>
          <label>
            {t.oldestAge}
            <input
              type="number"
              min={0}
              max={20}
              value={settings.preferences.max_child_age}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    max_child_age: Number(event.target.value),
                  },
                }))
              }
            />
          </label>
        </div>
        <label className="consent">
          <input
            type="checkbox"
            checked={settings.preferences.open_to_other_african_families}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                preferences: {
                  ...current.preferences,
                  open_to_other_african_families: event.target.checked,
                },
              }))
            }
          />
          {t.africanFamilies}
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={settings.preferences.open_to_all_diaspora_families}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                preferences: {
                  ...current.preferences,
                  open_to_all_diaspora_families: event.target.checked,
                },
              }))
            }
          />
          {t.diasporaFamilies}
        </label>
      </section>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <div className="family-settings-save">
        <button className="button button-primary" disabled={busy}>
          <Save size={17} /> {busy ? t.saving : t.save}
        </button>
      </div>
    </form>
  );
}
