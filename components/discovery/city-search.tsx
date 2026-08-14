"use client";

import { MapPin, Search } from "lucide-react";
import { useState } from "react";

import type { Locale } from "@/lib/i18n/config";

export type CitySearchCopy = {
  cityLabel: string;
  cityPlaceholder: string;
  search: string;
  searching: string;
  select: string;
  noCities: string;
  selectionPending: string;
  searchUnavailable: string;
  invalidLocation: string;
  germanyOnly: string;
  authenticationRequired: string;
  validationFailed: string;
  attribution: string;
  located: string;
};

type CityResult = {
  placeId: string;
  city: string;
  area: string | null;
  countryCode: string;
};

export function CitySearch({
  country,
  locale,
  copy,
  initialSelection,
}: {
  country: string;
  locale: Locale;
  copy: CitySearchCopy;
  initialSelection?: { placeId: string; city: string };
}) {
  const [query, setQuery] = useState(initialSelection?.city ?? "");
  const [results, setResults] = useState<CityResult[]>([]);
  const [selected, setSelected] = useState<CityResult | null>(
    initialSelection
      ? { ...initialSelection, area: null, countryCode: country }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [failure, setFailure] = useState(false);

  async function search() {
    if (query.trim().length < 2) return;
    setBusy(true);
    setSearched(false);
    setFailure(false);
    setSelected(null);
    try {
      const parameters = new URLSearchParams({
        query: query.trim(),
        country,
        locale,
      });
      const response = await fetch(`/api/location/search?${parameters}`);
      const body = (await response.json()) as {
        results?: CityResult[];
      };
      if (!response.ok) {
        setResults([]);
        setFailure(true);
        return;
      }
      setResults(body.results ?? []);
    } catch {
      setResults([]);
      setFailure(true);
    } finally {
      setBusy(false);
      setSearched(true);
    }
  }

  return (
    <div className="city-search">
      <label>
        {copy.cityLabel}
        <span className="city-search-row">
          <input
            value={query}
            type="search"
            autoComplete="address-level2"
            enterKeyHint="search"
            placeholder={copy.cityPlaceholder}
            minLength={2}
            maxLength={80}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              setFailure(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
          />
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void search()}
            disabled={busy || query.trim().length < 2}
          >
            <Search size={17} /> {busy ? copy.searching : copy.search}
          </button>
        </span>
      </label>
      <input
        type="hidden"
        name="locationPlaceId"
        value={selected?.placeId ?? ""}
      />
      <input type="hidden" name="city" value={selected?.city ?? ""} />
      {results.length > 0 && (
        <ul className="city-results" aria-label={copy.cityLabel}>
          {results.map((result) => (
            <li key={result.placeId}>
              <button
                type="button"
                aria-pressed={selected?.placeId === result.placeId}
                onClick={() => setSelected(result)}
              >
                <MapPin size={18} />
                <span>
                  <strong>{result.city}</strong>
                  {result.area && <small>{result.area}</small>}
                </span>
                <span>{copy.select}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && results.length === 0 && (
        <p className={failure ? "form-error" : "field-help"} role="status">
          {failure ? copy.searchUnavailable : copy.noCities}
        </p>
      )}
      {/* Typed text alone leaves the field looking complete while
          locationPlaceId is still empty, and the failure only surfaced on the
          final submit at the end of the wizard. Say so at the field instead. */}
      {!selected &&
        !busy &&
        query.trim().length >= 2 &&
        !(searched && results.length === 0) && (
          <p className="field-help" role="status">
            {copy.selectionPending}
          </p>
        )}
      {selected && (
        <p className="form-success" role="status">
          {copy.located}: {selected.city}
        </p>
      )}
      <a
        className="map-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        {copy.attribution}
      </a>
    </div>
  );
}
