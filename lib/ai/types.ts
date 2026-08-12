import type { AiFeature } from "@/lib/validation/ai";

export type AiJobStatus = "queued" | "processing" | "completed" | "failed";
export type AiModerationStatus =
  "pending_review" | "flagged" | "approved" | "rejected";

export type AiCompletionRequest = {
  feature: AiFeature;
  promptVersion: string;
  locale: "de" | "en" | "fr";
  context: Record<string, string>;
};

export type AiCompletion = {
  output: Record<string, unknown>;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  moderationStatus: "pending_review" | "flagged" | "rejected";
};

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletion>;
}
