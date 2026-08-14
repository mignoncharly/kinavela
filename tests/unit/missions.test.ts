import { describe, expect, it } from "vitest";

import {
  parseCulturalMissions,
  parseVillageMissions,
} from "@/features/missions/results";
import { missionActionSchema } from "@/lib/validation/missions";

const missionId = "a1000000-0000-4000-8000-000000000001";
const stepId = "a1100000-0000-4000-8000-000000000001";
const villageId = "b1000000-0000-4000-8000-000000000001";
const villageMissionId = "b1100000-0000-4000-8000-000000000001";

const mission = {
  mission_id: missionId,
  slug: "five-greetings-from-cameroon",
  title: "Learn five greetings from Cameroon",
  summary:
    "Explore greetings as a family and practise making space for one another.",
  description:
    "Choose five greetings connected to your family roots and practise them together.",
  category: "language",
  culture_id: "20000000-0000-4000-8000-000000000001",
  culture_name: "Cameroon",
  country_name: "Cameroon",
  min_age: 3,
  max_age: 18,
  estimated_minutes: 30,
  cultural_context:
    "Cameroon is multilingual, so every greeting keeps its specific language and family context.",
  materials: ["Paper", "A trusted speaker"],
  guardian_guidance:
    "Ask before recording and let every child participate in a comfortable way.",
  respectful_attribution:
    "Credit the person, language and community that taught each family greeting.",
  passport_reflection_prompt:
    "Which greeting would your family like to remember and why?",
  context_scope: "country",
  content_version: 2,
  content_locale: "en",
  steps: [
    {
      step_id: stepId,
      position: 1,
      title: "Discover",
      description:
        "Choose five greetings and ask a trusted speaker about their context.",
    },
  ],
  progress_id: null,
  progress_status: null,
  completed_step_ids: [],
  completed_at: null,
};

describe("Cultural mission contracts", () => {
  it("accepts privacy-safe library and Village projections", () => {
    expect(parseCulturalMissions([mission]).success).toBe(true);
    expect(
      parseVillageMissions([
        {
          ...mission,
          village_mission_id: villageMissionId,
          assigned_at: "2026-08-11T08:00:00+00:00",
        },
      ]).success,
    ).toBe(true);
    expect(
      parseCulturalMissions([{ ...mission, child_name: "private" }]).success,
    ).toBe(false);
  });

  it("requires explicit mission and step actions", () => {
    expect(
      missionActionSchema.safeParse({
        action: "complete_step",
        mission_id: missionId,
        step_id: stepId,
        village_mission_id: villageMissionId,
      }).success,
    ).toBe(true);
    expect(
      missionActionSchema.safeParse({ action: "assign", village_id: villageId })
        .success,
    ).toBe(false);
    expect(
      missionActionSchema.safeParse({
        action: "complete_step",
        mission_id: missionId,
        step_id: stepId,
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("requires the complete reviewed-content projection", () => {
    expect(parseCulturalMissions([mission]).success).toBe(true);
    expect(
      parseCulturalMissions([{ ...mission, respectful_attribution: undefined }])
        .success,
    ).toBe(false);
    expect(
      parseCulturalMissions([{ ...mission, context_scope: "universal" }])
        .success,
    ).toBe(false);
    expect(
      parseCulturalMissions([{ ...mission, content_locale: "es" }]).success,
    ).toBe(false);
  });
});
