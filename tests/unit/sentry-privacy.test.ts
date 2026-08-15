import type { Breadcrumb, Event } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import {
  redactSentryText,
  sanitizeSentryUrl,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "@/lib/observability/sentry-privacy";

describe("Sentry privacy filtering", () => {
  it("redacts email addresses, bearer values and sensitive query values", () => {
    expect(
      redactSentryText(
        "contact parent@example.com with Bearer secret.token-value?token=abc123",
      ),
    ).toBe("contact [email] with Bearer [token]?token=[filtered]");
  });

  it("removes query strings and opaque route identifiers", () => {
    expect(
      sanitizeSentryUrl(
        "https://www.kinavela.com/de/invite/private-invitation-token?code=secret",
      ),
    ).toBe("https://www.kinavela.com/de/invite/[filtered]");
    expect(
      sanitizeSentryUrl(
        "/de/app/messages/123e4567-e89b-12d3-a456-426614174000?email=a@b.de",
      ),
    ).toBe("/de/app/messages/[id]");
  });

  it("drops user identity and request payload data from events", () => {
    const event = scrubSentryEvent({
      user: { id: "family-owner", email: "parent@example.com" },
      request: {
        method: "POST",
        url: "https://www.kinavela.com/api/messages?token=secret",
        headers: { authorization: "Bearer secret" },
        data: { body: "private family message" },
      },
      extra: {
        password: "secret",
        note: "contact parent@example.com",
      },
    } as Event);

    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({
      method: "POST",
      url: "https://www.kinavela.com/api/messages",
    });
    expect(event.extra).toEqual({
      password: "[Filtered]",
      note: "contact [email]",
    });
  });

  it("drops console breadcrumbs and sanitizes network URLs", () => {
    expect(
      scrubSentryBreadcrumb({
        category: "console",
        message: "child nickname",
      }),
    ).toBeNull();
    expect(
      scrubSentryBreadcrumb({
        category: "ui.click",
        message: "button#child-name",
      }),
    ).toBeNull();

    const breadcrumb = scrubSentryBreadcrumb({
      category: "fetch",
      data: {
        method: "GET",
        url: "/api/invitations?token=private",
      },
    } as Breadcrumb);

    expect(breadcrumb?.data).toEqual({
      method: "GET",
      url: "/api/invitations",
    });
  });
});
