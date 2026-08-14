import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { aiErrorCode } from "@/lib/ai/logging";
import { assertAiProviderReady } from "@/lib/ai/provider";
import { transcribeAudio } from "@/lib/ai/transcription";
import { getPromptVersion } from "@/lib/ai/prompts";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

const MAX_JOBS_PER_RUN = 2;

function authorized(request: Request) {
  const secret = serverEnv.AI_WORKER_CRON_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer /, "");
  if (!secret || !supplied || secret.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(supplied));
}

function storyLocale(language: string | null) {
  return language === "de" || language === "en" || language === "fr"
    ? language
    : "en";
}

function completionText(output: Record<string, unknown>) {
  for (const key of ["content", "text", "result", "adaptation"]) {
    if (typeof output[key] === "string" && output[key].trim())
      return output[key].trim();
  }
  const serialized = JSON.stringify(output);
  if (!serialized || serialized === "{}")
    throw Object.assign(new Error("AI output is empty"), {
      code: "ai_empty_response",
    });
  return serialized;
}

async function completeStoryJob(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  values: Record<string, unknown>,
) {
  const { error } = await admin.rpc("complete_story_ai_job", {
    p_job_id: jobId,
    p_status: "completed",
    ...values,
  });
  if (error) throw error;
}

async function failStoryJob(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  error: unknown,
) {
  await admin.rpc("complete_story_ai_job", {
    p_job_id: jobId,
    p_status: "failed",
    p_error_code: aiErrorCode(error),
  });
}

export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createAdminClient();
  await admin.rpc("record_story_worker_run", { p_state: "started" });
  let provider;
  try {
    provider = assertAiProviderReady();
  } catch (error) {
    await admin.rpc("record_story_worker_run", {
      p_state: "provider_unavailable",
      p_error_code: aiErrorCode(error),
    });
    return NextResponse.json(
      { ok: false, errorCode: aiErrorCode(error) },
      { status: 503 },
    );
  }

  let processed = 0;
  let failed = 0;
  for (let index = 0; index < MAX_JOBS_PER_RUN; index += 1) {
    const { data, error } = await admin.rpc("claim_story_ai_job");
    if (error) {
      await admin.rpc("record_story_worker_run", {
        p_state: "failed",
        p_error_code: "story_job_claim_failed",
      });
      return NextResponse.json({ ok: false }, { status: 503 });
    }
    const job = Array.isArray(data) ? data[0] : data;
    if (!job?.job_id) break;
    processed += 1;
    try {
      if (job.job_type === "transcribe") {
        const { data: audio, error: audioError } = await admin.storage
          .from("story-audio")
          .download(job.audio_path);
        if (audioError || !audio)
          throw Object.assign(new Error("Story audio unavailable"), {
            code: "ai_audio_unavailable",
          });
        const declaredAudioSize = Number(job.audio_size_bytes);
        if (
          !Number.isSafeInteger(declaredAudioSize) ||
          declaredAudioSize < 1 ||
          declaredAudioSize > serverEnv.AI_TRANSCRIPTION_MAX_BYTES ||
          audio.size > serverEnv.AI_TRANSCRIPTION_MAX_BYTES
        )
          throw Object.assign(new Error("Story audio is too large"), {
            code: "ai_audio_too_large",
          });
        const transcription = await transcribeAudio({
          file: audio,
          mimeType: job.audio_mime_type,
          language: job.original_language,
        });
        await completeStoryJob(admin, job.job_id, {
          p_original_language:
            transcription.language ?? job.original_language ?? null,
          p_transcript: transcription.text,
        });
      } else if (job.job_type === "translate") {
        const translation = await provider.complete({
          feature: "story_translation",
          promptVersion: getPromptVersion("story_translation"),
          locale: storyLocale(job.requested_translation_language),
          context: {
            target_language: job.requested_translation_language ?? "en",
            transcript: job.transcript_original ?? "",
            story_question: job.request_question,
          },
        });
        await completeStoryJob(admin, job.job_id, {
          p_translation: completionText(translation.output),
        });
      } else if (job.job_type === "adapt") {
        const adaptation = await provider.complete({
          feature: "story_adaptation",
          promptVersion: getPromptVersion("story_adaptation"),
          locale: storyLocale(
            job.requested_translation_language ?? job.original_language,
          ),
          context: {
            output_language:
              job.requested_translation_language ??
              job.original_language ??
              "en",
            story_title: job.story_title,
            story_question: job.request_question,
            transcript:
              job.transcript_translation ?? job.transcript_original ?? "",
          },
        });
        await completeStoryJob(admin, job.job_id, {
          p_adaptation: completionText(adaptation.output),
        });
      } else {
        throw Object.assign(new Error("Unknown story AI job"), {
          code: "ai_invalid_job",
        });
      }
    } catch (error) {
      failed += 1;
      await failStoryJob(admin, job.job_id, error);
    }
  }
  await admin.rpc("record_story_worker_run", {
    p_state: "completed",
    p_processed: processed,
    p_failed: failed,
  });
  return NextResponse.json({ ok: true, processed, failed });
}
