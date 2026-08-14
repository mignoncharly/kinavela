export const validFamilySettings = {
  family: {
    name: "The Nkom family",
    bio: "Cameroonian roots in Bavaria.",
    visibility: "discoverable",
  },
  children: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      nickname: "Little Root",
      birth_year: 2020,
      birth_month: 6,
      gender: null,
      visibility: "guardians",
    },
  ],
  cultures: [
    {
      culture_id: "20000000-0000-4000-8000-000000000001",
      relationship_type: "origin",
      priority: 5,
    },
  ],
  languages: [
    {
      language_id: "30000000-0000-4000-8000-000000000002",
      proficiency: "fluent",
      transmission_goal: "already_speaking",
    },
    {
      language_id: "30000000-0000-4000-8000-000000000004",
      proficiency: "conversational",
      transmission_goal: "want_to_teach_children",
    },
  ],
  preservation_goals: ["language", "stories"],
  interest_ids: [
    "40000000-0000-4000-8000-000000000001",
    "40000000-0000-4000-8000-000000000003",
  ],
  availability: [
    { weekday: 3, period: "afternoon" },
    { weekday: 6, period: "morning" },
  ],
  preferences: {
    same_country_priority: 5,
    same_culture_priority: 5,
    similar_child_age_priority: 4,
    same_language_priority: 4,
    shared_interests_priority: 3,
    availability_priority: 3,
    open_to_other_african_families: true,
    open_to_all_diaspora_families: false,
    min_child_age: 2,
    max_child_age: 14,
  },
} as const;
