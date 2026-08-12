import type { AiJobStatus, AiModerationStatus } from "@/lib/ai/types";
import type { AiFeature } from "@/lib/validation/ai";

export function aiLogFields(input: {
  jobId: string;
  feature: AiFeature;
  status: AiJobStatus;
  moderationStatus?: AiModerationStatus;
  provider?: string | null;
  model?: string | null;
  errorCode?: string | null;
}) {
  return {
    event: "ai_job",
    jobId: input.jobId,
    feature: input.feature,
    status: input.status,
    moderationStatus: input.moderationStatus ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    errorCode: input.errorCode ?? null,
  };
}

export function aiErrorCode(error: unknown) {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string"
  )
    return error.code.slice(0, 80);
  return "ai_provider_error";
}
