import "server-only";

import { serverEnv } from "@/lib/env.server";

import type { AiCompletion, AiProvider } from "@/lib/ai/types";

export class AiProviderUnavailableError extends Error {
  readonly code = "ai_provider_unconfigured";
}

export class AiProviderRequestError extends Error {
  constructor(
    readonly code: string,
    message = "AI provider request failed",
  ) {
    super(message);
    this.name = "AiProviderRequestError";
  }
}

class DisabledAiProvider implements AiProvider {
  async complete(): Promise<AiCompletion> {
    throw new AiProviderUnavailableError("No AI provider is configured");
  }
}

const disabledProvider = new DisabledAiProvider();

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const MODEL_PRICING_USD_PER_MILLION: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-5.6-sol": { input: 5, output: 30 },
  "gpt-5.6-terra": { input: 2.5, output: 15 },
  "gpt-5.6-luna": { input: 1, output: 6 },
};

type OpenAiResponse = {
  output_text?: unknown;
  output?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function extractOutputText(response: OpenAiResponse) {
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return "";
  const pieces: string[] = [];
  for (const item of response.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (typeof content.text === "string") pieces.push(content.text);
    }
  }
  return pieces.join("\n");
}

function parseOutput(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^\x60\x60\x60(?:json)?\s*/i, "")
    .replace(/\s*\x60\x60\x60$/, "")
    .trim();
  try {
    const parsed: unknown = JSON.parse(unfenced);
    return isRecord(parsed) ? parsed : { content: trimmed };
  } catch {
    return { content: trimmed };
  }
}

function promptFor(request: Parameters<AiProvider["complete"]>[0]) {
  const context = Object.entries(request.context)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return [
    `Feature: ${request.feature}`,
    `Locale: ${request.locale}`,
    `Prompt version: ${request.promptVersion}`,
    "Return one JSON object only. Keep the result factual, culturally humble, and suitable for guardian review.",
    "Do not infer ethnicity, identity, parenting quality, safety, or social ranking. Do not invent facts.",
    "Do not include personal identifiers, exact locations, contact details, or provider metadata in the result.",
    "Context:",
    context || "(no additional context)",
  ].join("\n");
}

class OpenAiProvider implements AiProvider {
  async complete(
    request: Parameters<AiProvider["complete"]>[0],
  ): Promise<AiCompletion> {
    if (request.feature === "story_transcription") {
      throw new AiProviderUnavailableError(
        "Audio transcription requires the dedicated audio worker",
      );
    }
    const model = serverEnv.OPENAI_MODEL;
    const pricing = MODEL_PRICING_USD_PER_MILLION[model];
    if (!pricing || !serverEnv.OPENAI_API_KEY) {
      throw new AiProviderUnavailableError(
        "OpenAI credentials are unavailable",
      );
    }
    let response: Response;
    try {
      response = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: promptFor(request),
          store: false,
          reasoning: { effort: serverEnv.AI_REASONING_EFFORT },
          max_output_tokens: serverEnv.AI_MAX_OUTPUT_TOKENS,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new AiProviderRequestError("ai_provider_unavailable");
    }
    if (!response.ok) {
      const code =
        response.status === 401
          ? "ai_provider_auth_failed"
          : response.status === 429
            ? "ai_rate_limited"
            : response.status >= 500
              ? "ai_provider_unavailable"
              : "ai_provider_invalid_request";
      throw new AiProviderRequestError(code);
    }
    const payload = (await response.json()) as OpenAiResponse;
    const text = extractOutputText(payload);
    if (!text.trim()) throw new AiProviderRequestError("ai_empty_response");
    const inputTokens = readInteger(payload.usage?.input_tokens);
    const outputTokens = readInteger(payload.usage?.output_tokens);
    const costMicros = Math.ceil(
      inputTokens * pricing.input + outputTokens * pricing.output,
    );
    return {
      output: parseOutput(text),
      provider: "openai",
      model,
      inputTokens,
      outputTokens,
      costMicros,
      moderationStatus: "pending_review",
    };
  }
}

const openAiProvider = new OpenAiProvider();

export function getAiProvider(): AiProvider {
  const provider = serverEnv.AI_PROVIDER;
  if (provider === "disabled") return disabledProvider;
  if (provider === "openai") {
    if (!serverEnv.AI_PROCESSING_APPROVED)
      throw new AiProviderUnavailableError(
        "AI processing approval is required",
      );
    return openAiProvider;
  }
  throw new AiProviderUnavailableError("Configured AI provider is unavailable");
}

export function assertAiProviderReady(): AiProvider {
  if (serverEnv.AI_PROVIDER === "disabled")
    throw new AiProviderUnavailableError("No AI provider is configured");
  return getAiProvider();
}

export function isAiProviderReady() {
  try {
    assertAiProviderReady();
    return true;
  } catch {
    return false;
  }
}
