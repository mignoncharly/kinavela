import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CitySearch,
  type CitySearchCopy,
} from "@/components/discovery/city-search";

const copy = {
  cityLabel: "City",
  cityPlaceholder: "City",
  search: "Search",
  searching: "Searching",
  select: "Select",
  noCities: "No cities found",
  selectionPending: "Search, then choose your city from the list.",
  searchUnavailable: "Search unavailable",
  invalidLocation: "Invalid",
  germanyOnly: "Germany only",
  authenticationRequired: "Auth required",
  validationFailed: "Validation failed",
  attribution: "OSM",
  located: "Located",
} satisfies CitySearchCopy;

function mount() {
  const { container } = render(
    <CitySearch country="DE" locale="en" copy={copy} />,
  );
  return {
    container,
    input: container.querySelector("input[type=search]") as HTMLInputElement,
    placeId: () =>
      (
        container.querySelector(
          'input[name="locationPlaceId"]',
        ) as HTMLInputElement
      ).value,
    text: () => container.textContent ?? "",
  };
}

describe("city search selection state", () => {
  it("says a selection is still needed once text is typed", () => {
    const c = mount();
    expect(c.text()).not.toContain(copy.selectionPending);

    fireEvent.change(c.input, { target: { value: "Mainz" } });
    // This is the on3.jpg trap: the field looks filled, but nothing is selected.
    expect(c.placeId()).toBe("");
    expect(c.text()).toContain(copy.selectionPending);
  });

  it("clears the hint once a result is chosen", async () => {
    const results = [
      { placeId: "osm:1", city: "Mainz", area: "RLP", countryCode: "DE" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ results }), { status: 200 }),
      ),
    );
    const c = mount();
    fireEvent.change(c.input, { target: { value: "Mainz" } });
    fireEvent.keyDown(c.input, { key: "Enter" });
    await vi.waitFor(() =>
      expect(c.container.querySelector(".city-results")).toBeTruthy(),
    );

    fireEvent.click(
      c.container.querySelector(".city-results button") as HTMLButtonElement,
    );
    expect(c.placeId()).toBe("osm:1");
    expect(c.text()).not.toContain(copy.selectionPending);
    expect(c.text()).toContain(copy.located);
    vi.unstubAllGlobals();
  });
});
