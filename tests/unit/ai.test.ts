import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockedEnv = vi.hoisted(() => ({
  serverEnv: {
    AI_PROVIDER: "disabled" as "disabled" | "openai",
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "gpt-5.6-terra" as const,
    AI_REASONING_EFFORT: "medium" as const,
    AI_MAX_OUTPUT_TOKENS: 2048,
    AI_PROCESSING_APPROVED: false,
    AI_WORKER_CRON_SECRET: "",
    OPENAI_TRANSCRIPTION_MODEL: "gpt-4o-transcribe" as const,
    AI_TRANSCRIPTION_MAX_BYTES: 25000000,
  },
}));

vi.mock("@/lib/env.server", () => mockedEnv);

import { transcribeAudio } from "@/lib/ai/transcription";
import { aiErrorCode, aiLogFields } from "@/lib/ai/logging";
import { getPromptVersion } from "@/lib/ai/prompts";
import {
  AiProviderUnavailableError,
  assertAiProviderReady,
  getAiProvider,
} from "@/lib/ai/provider";
import { aiActionSchema } from "@/lib/validation/ai";

describe("AI layer contracts", () => {
  it("uses explicit versioned prompts", () => {
    expect(getPromptVersion("story_adaptation")).toBe("story-adaptation-v1");
    expect(getPromptVersion("cultural_activity_ideas")).toBe(
      "cultural-activity-v1",
    );
  });

  it("rejects oversized or undeclared AI input", () => {
    expect(
      aiActionSchema.safeParse({
        action: "create",
        feature: "cultural_activity_ideas",
        subject_type: "family_context",
        locale: "fr",
        context: { prompt: "Respectful activity ideas" },
      }).success,
    ).toBe(true);
    expect(
      aiActionSchema.safeParse({
        action: "create",
        feature: "unknown_feature",
        subject_type: "family_context",
        locale: "fr",
        context: {},
      }).success,
    ).toBe(false);
    expect(
      aiActionSchema.safeParse({
        action: "create",
        feature: "mission_draft",
        subject_type: "family_context",
        locale: "fr",
        context: { prompt: "x".repeat(16001) },
      }).success,
    ).toBe(false);
  });

  it("does not queue work while the provider is disabled", () => {
    expect(() => assertAiProviderReady()).toThrow(AiProviderUnavailableError);
  });

  it("keeps the default provider disabled and logs metadata only", async () => {
    const provider = getAiProvider();
    await expect(
      provider.complete({
        feature: "event_description",
        promptVersion: "event-description-v1",
        locale: "en",
        context: {},
      }),
    ).rejects.toBeInstanceOf(AiProviderUnavailableError);
    expect(aiErrorCode(new AiProviderUnavailableError("private prompt"))).toBe(
      "ai_provider_unconfigured",
    );
    expect(
      aiLogFields({
        jobId: "a0000000-0000-4000-8000-000000000001",
        feature: "event_description",
        status: "failed",
        errorCode: "ai_provider_unconfigured",
      }),
    ).not.toHaveProperty("context");
  });

  it("calls OpenAI through the Responses API without exposing provider details", async () => {
    mockedEnv.serverEnv.AI_PROVIDER = "openai";
    mockedEnv.serverEnv.OPENAI_API_KEY =
      "test-openai-key-that-is-never-returned";
    mockedEnv.serverEnv.AI_PROCESSING_APPROVED = true;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({ content: "Reviewable draft" }),
          usage: { input_tokens: 10, output_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const completion = await getAiProvider().complete({
      feature: "event_description",
      promptVersion: "event-description-v1",
      locale: "en",
      context: { title: "Family event" },
    });
    expect(completion.output).toEqual({ content: "Reviewable draft" });
    expect(completion.provider).toBe("openai");
    expect(completion.model).toBe("gpt-5.6-terra");
    expect(completion.costMicros).toBe(85);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toEqual(
      expect.objectContaining({ "content-type": "application/json" }),
    );
    expect(String(request.body)).toContain('"store":false');
    expect(String(request.body)).not.toContain("test-openai-key");
    vi.unstubAllGlobals();
    mockedEnv.serverEnv.AI_PROVIDER = "disabled";
    mockedEnv.serverEnv.OPENAI_API_KEY = "";
    mockedEnv.serverEnv.AI_PROCESSING_APPROVED = false;
  });

  it("maps provider failures to bounded error codes", async () => {
    mockedEnv.serverEnv.AI_PROVIDER = "openai";
    mockedEnv.serverEnv.OPENAI_API_KEY =
      "test-openai-key-that-is-never-returned";
    mockedEnv.serverEnv.AI_PROCESSING_APPROVED = true;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
    );
    await expect(
      getAiProvider().complete({
        feature: "mission_draft",
        promptVersion: "mission-draft-v1",
        locale: "fr",
        context: {},
      }),
    ).rejects.toMatchObject({ code: "ai_rate_limited" });
    vi.unstubAllGlobals();
    mockedEnv.serverEnv.AI_PROVIDER = "disabled";
    mockedEnv.serverEnv.OPENAI_API_KEY = "";
    mockedEnv.serverEnv.AI_PROCESSING_APPROVED = false;
  });

  it("uploads private audio as multipart form data to transcription", async () => {
    mockedEnv.serverEnv.AI_PROVIDER = "openai";
    mockedEnv.serverEnv.OPENAI_API_KEY =
      "test-openai-key-that-is-never-returned";
    mockedEnv.serverEnv.AI_PROCESSING_APPROVED = true;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ text: "A faithful transcript", language: "fr" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await transcribeAudio({
      file: new Blob(["audio bytes"], { type: "audio/webm" }),
      mimeType: "audio/webm",
      language: "fr",
    });
    expect(result.text).toBe("A faithful transcript");
    expect(result.language).toBe("fr");
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("model")).toBe("gpt-4o-transcribe");
    expect(body.get("response_format")).toBe("json");
    expect(body.get("language")).toBe("fr");
    expect(body.get("file")).toBeInstanceOf(Blob);
    vi.unstubAllGlobals();
    mockedEnv.serverEnv.AI_PROVIDER = "disabled";
    mockedEnv.serverEnv.OPENAI_API_KEY = "";
    mockedEnv.serverEnv.AI_PROCESSING_APPROVED = false;
  });

  it("rejects audio above the configured provider limit before upload", async () => {
    mockedEnv.serverEnv.OPENAI_API_KEY =
      "test-openai-key-that-is-never-returned";
    mockedEnv.serverEnv.AI_TRANSCRIPTION_MAX_BYTES = 4;
    await expect(
      transcribeAudio({
        file: new Blob(["12345"], { type: "audio/webm" }),
        mimeType: "audio/webm",
        language: "en",
      }),
    ).rejects.toMatchObject({ code: "ai_audio_too_large" });
    mockedEnv.serverEnv.AI_TRANSCRIPTION_MAX_BYTES = 25000000;
    mockedEnv.serverEnv.OPENAI_API_KEY = "";
  });
});
