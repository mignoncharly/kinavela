import type { AiFeature } from "@/lib/validation/ai";

export const aiPromptVersions: Record<AiFeature, string> = {
  story_transcription: "story-transcription-v1",
  story_translation: "story-translation-v1",
  story_adaptation: "story-adaptation-v1",
  cultural_activity_ideas: "cultural-activity-v1",
  mission_draft: "mission-draft-v1",
  event_description: "event-description-v1",
};

export function getPromptVersion(feature: AiFeature) {
  return aiPromptVersions[feature];
}
