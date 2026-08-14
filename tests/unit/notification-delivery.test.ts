import { describe, expect, it, vi } from "vitest";

import {
  getNotificationDeliveryCopy,
  notificationEmailCopy,
} from "@/features/notifications/email-copy";
import { locales } from "@/lib/i18n/config";
import { notificationKindSchema } from "@/lib/validation/notifications";

const { sendTransactionalEmail } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/transport", () => ({ sendTransactionalEmail }));

const { sendNotificationEmail } =
  await import("@/features/notifications/email");

describe("localized notification delivery", () => {
  it.each(locales)("covers every email and push kind in %s", (locale) => {
    const copy = notificationEmailCopy[locale];
    for (const kind of notificationKindSchema.options) {
      expect(copy.subjects[kind]).not.toHaveLength(0);
      expect(copy.bodies[kind]).not.toHaveLength(0);
    }
  });

  it("uses English only as a privacy-safe fallback for an invalid delivery locale", () => {
    expect(getNotificationDeliveryCopy("invalid")).toBe(
      notificationEmailCopy.en,
    );
  });

  it("renders the localized subject, text, and HTML action without provider data", async () => {
    sendTransactionalEmail.mockReset();

    await sendNotificationEmail(
      "family@example.test",
      "fr",
      "message_received",
      "https://kinavela.example/fr/app/messages?source=email&safe=true",
    );

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Kinavela · Nouveau message privé",
        text: expect.stringContaining("Ouvrir Kinavela:"),
        html: expect.stringContaining("source=email&amp;safe=true"),
      }),
    );
    expect(JSON.stringify(sendTransactionalEmail.mock.calls)).not.toContain(
      "Private street",
    );
  });
});
