import "server-only";

import { serverEnv } from "@/lib/env.server";
import {
  AiProviderRequestError,
  AiProviderUnavailableError,
} from "@/lib/ai/provider";

const TRANSCRIPTION_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
const AUDIO_PRICING_USD_PER_MILLION = { input: 2.5, output: 10 };

type TranscriptionResponse = {
  text?: unknown;
  language?: unknown;
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
  };
};

export type AiTranscription = {
  text: string;
  language: string | null;
  provider: "openai";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
};

function readInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function extensionFor(mimeType: string) {
  return {
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/mp4": "mp4",
    "audio/webm": "webm",
  }[mimeType];
}

export async function transcribeAudio(input: {
  file: Blob;
  mimeType: string;
  language: string | null;
}): Promise<AiTranscription> {
  if (!serverEnv.OPENAI_API_KEY)
    throw new AiProviderUnavailableError("OpenAI credentials are unavailable");
  const extension = extensionFor(input.mimeType);
  if (!extension) throw new AiProviderRequestError("ai_invalid_audio_type");
  if (input.file.size > serverEnv.AI_TRANSCRIPTION_MAX_BYTES)
    throw new AiProviderRequestError("ai_audio_too_large");

  const form = new FormData();
  form.append("file", input.file, `story.${extension}`);
  form.append("model", serverEnv.OPENAI_TRANSCRIPTION_MODEL);
  form.append("response_format", "json");
  if (input.language && /^[a-z]{2,3}$/.test(input.language))
    form.append("language", input.language);

  let response: Response;
  try {
    response = await fetch(TRANSCRIPTION_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${serverEnv.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new AiProviderRequestError("ai_provider_unavailable");
  }
  if (!response.ok) {
    const code =
      response.status === 401
        ? "ai_provider_auth_failed"
        : response.status === 413
          ? "ai_audio_too_large"
          : response.status === 429
            ? "ai_rate_limited"
            : response.status >= 500
              ? "ai_provider_unavailable"
              : "ai_provider_invalid_request";
    throw new AiProviderRequestError(code);
  }
  const payload = (await response.json()) as TranscriptionResponse;
  if (typeof payload.text !== "string" || !payload.text.trim())
    throw new AiProviderRequestError("ai_empty_transcription");
  const inputTokens = readInteger(payload.usage?.input_tokens);
  const outputTokens = readInteger(payload.usage?.output_tokens);
  return {
    text: payload.text.trim(),
    language:
      typeof payload.language === "string" &&
      /^[a-z]{2,3}$/.test(payload.language)
        ? payload.language
        : input.language,
    provider: "openai",
    model: serverEnv.OPENAI_TRANSCRIPTION_MODEL,
    inputTokens,
    outputTokens,
    costMicros: Math.ceil(
      inputTokens * AUDIO_PRICING_USD_PER_MILLION.input +
        outputTokens * AUDIO_PRICING_USD_PER_MILLION.output,
    ),
  };
}
