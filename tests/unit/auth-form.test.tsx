import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";
import type { Locale } from "@/lib/i18n/config";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillSignupForm(
  container: HTMLElement,
  password: string,
  consent = true,
) {
  fireEvent.change(
    container.querySelector<HTMLInputElement>('input[name="displayName"]')!,
    { target: { value: "Nkom Family" } },
  );
  fireEvent.change(
    container.querySelector<HTMLInputElement>('input[name="email"]')!,
    { target: { value: "family@example.com" } },
  );
  fireEvent.change(
    container.querySelector<HTMLInputElement>('input[name="password"]')!,
    { target: { value: password } },
  );
  if (consent) {
    fireEvent.click(
      container.querySelector<HTMLInputElement>('input[name="consent"]')!,
    );
  }
}

describe("authentication form feedback", () => {
  it.each([
    [
      "de",
      "Dein Passwort muss mindestens 12 Zeichen lang sein und Groß- und Kleinbuchstaben sowie eine Zahl enthalten.",
    ],
    [
      "fr",
      "Votre mot de passe doit comporter au moins 12 caractères, avec une majuscule, une minuscule et un chiffre.",
    ],
    [
      "en",
      "Your password must be at least 12 characters and include an uppercase letter, a lowercase letter, and a number.",
    ],
  ] as const)(
    "explains a weak signup password in %s before making a request",
    (locale, expected) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { container } = render(
        <AuthForm locale={locale as Locale} mode="signup" />,
      );
      fillSignupForm(container, "short");
      fireEvent.submit(container.querySelector("form")!);

      expect(screen.getByRole("alert")).toHaveTextContent(expected);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("explains when registration is temporarily unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "service_unavailable" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AuthForm locale="en" mode="signup" />);
    fillSignupForm(container, "LongSecurePassword9");
    fireEvent.submit(container.querySelector("form")!);

    expect(
      await screen.findByText(
        "Registration is temporarily unavailable. No account was created. Please try again later.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
