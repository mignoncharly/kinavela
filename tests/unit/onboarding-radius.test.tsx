import { fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

type WizardProps = ComponentProps<typeof OnboardingWizard>;
type Draft = WizardProps["initialDraft"];

const props = {
  locale: "fr" as const,
  profileName: "Test",
  countries: [{ id: "1", name_key: "countries.de", iso2: "DE", emoji: "DE" }],
  cultures: [{ id: "c1", name_key: "cultures.cameroonian" }],
  languages: [{ id: "l1", name_key: "languages.french" }],
  interests: [{ id: "i1", name_key: "interests.playdates" }],
  discoveryCopy: {},
} as unknown as WizardProps;

// Scoped to each render's own container: these tests render more than one
// wizard, and a document-wide query would keep matching the first one.
function mount(initialDraft?: Draft) {
  const { container } = render(
    <OnboardingWizard {...props} initialDraft={initialDraft} />,
  );
  const slider = container.querySelector(
    'input[name="radius"]',
  ) as HTMLInputElement;
  const readout = container.querySelector("output") as HTMLOutputElement;
  return { slider, readout, container };
}

describe("onboarding radius slider", () => {
  it("reports the slider's own value rather than a fixed one", () => {
    const { slider, readout } = mount();
    expect(slider.value).toBe("40");
    expect(readout.textContent).toContain("40");

    fireEvent.change(slider, { target: { value: "75" } });
    expect(slider.value).toBe("75");
    expect(readout.textContent).toContain("75");

    fireEvent.change(slider, { target: { value: "5" } });
    expect(slider.value).toBe("5");
    expect(readout.textContent).toContain("5");
  });

  it("restores a saved draft radius", () => {
    const { slider, readout } = mount({
      step: 0,
      values: { radius: "65" },
    } as unknown as Draft);
    expect(slider.value).toBe("65");
    expect(readout.textContent).toContain("65");
  });

  it("falls back to 40 when the draft radius is missing or out of range", () => {
    expect(
      mount({ step: 0, values: {} } as unknown as Draft).slider.value,
    ).toBe("40");
    expect(
      mount({ step: 0, values: { radius: "999" } } as unknown as Draft).slider
        .value,
    ).toBe("40");
    expect(
      mount({ step: 0, values: { radius: "nonsense" } } as unknown as Draft)
        .slider.value,
    ).toBe("40");
  });
});
