import { describe, expect, it } from "vitest";

import {
  parseRootsEntries,
  parseRootsPassports,
} from "@/features/roots/results";
import { rootsActionSchema } from "@/lib/validation/roots";

const childId = "a0000000-0000-4000-8000-000000000001";
const passportId = "a1000000-0000-4000-8000-000000000001";
const entryId = "a2000000-0000-4000-8000-000000000001";

describe("Roots Passport contracts", () => {
  it("accepts only the private child passport projection", () => {
    expect(
      parseRootsPassports([
        {
          passport_id: passportId,
          child_id: childId,
          child_nickname: "Little Root",
          entry_count: 2,
          last_occurred_at: "2026-08-11T08:00:00+00:00",
        },
      ]).success,
    ).toBe(true);
    expect(
      parseRootsPassports([
        {
          passport_id: passportId,
          child_id: childId,
          child_nickname: "Little Root",
          entry_count: 2,
          last_occurred_at: null,
          guardian_email: "private",
        },
      ]).success,
    ).toBe(false);
  });

  it("accepts timeline entries without exposing media paths", () => {
    expect(
      parseRootsEntries([
        {
          entry_id: entryId,
          passport_id: passportId,
          child_id: childId,
          type: "achievement",
          title: "A completed mission",
          description: "We practised together.",
          culture_name: "Cameroon",
          language_name: null,
          event_id: null,
          mission_id: "a3000000-0000-4000-8000-000000000001",
          village_id: null,
          occurred_at: "2026-08-11T08:00:00+00:00",
          visibility: "private",
          media_kind: null,
          media_available: false,
          created_at: "2026-08-11T08:00:00+00:00",
        },
      ]).success,
    ).toBe(true);
    expect(
      parseRootsEntries([{ entry_id: entryId, media_path: "secret" }]).success,
    ).toBe(false);
  });

  it("requires explicit child ownership actions", () => {
    expect(
      rootsActionSchema.safeParse({
        action: "create_entry",
        child_id: childId,
        type: "family_memory",
        title: "A memory",
        description: "A private family memory.",
        visibility: "private",
      }).success,
    ).toBe(true);
    expect(
      rootsActionSchema.safeParse({ action: "export", child_id: childId })
        .success,
    ).toBe(true);
    expect(
      rootsActionSchema.safeParse({
        action: "create_entry",
        child_id: childId,
        type: "family_memory",
        title: "x",
        visibility: "public",
      }).success,
    ).toBe(false);
  });
});
