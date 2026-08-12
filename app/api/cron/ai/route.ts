import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { aiErrorCode } from "@/lib/ai/logging";
import { assertAiProviderReady } from "@/lib/ai/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";
import { aiFeatures } from "@/lib/validation/ai";

export const dynamic = "force-dynamic";

const MAX_JOBS_PER_RUN = 5;

function authorized(request: Request) {
  const secret = serverEnv.AI_WORKER_CRON_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer /, "");
  if (!secret || !supplied || secret.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(supplied));
}

function validLocale(value: string): value is "de" | "en" | "fr" {
  return value === "de" || value === "en" || value === "fr";
}

function validFeature(value: string) {
  return (aiFeatures as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ ok: false }, { status: 401 });
  let provider;
  try {
    provider = assertAiProviderReady();
  } catch (error) {
    return NextResponse.json(
      { ok: false, errorCode: aiErrorCode(error) },
      { status: 503 },
    );
  }
  const admin = createAdminClient();
  let processed = 0;
  let failed = 0;
  for (let index = 0; index < MAX_JOBS_PER_RUN; index += 1) {
    const { data, error } = await admin.rpc("claim_ai_job");
    if (error) return NextResponse.json({ ok: false }, { status: 503 });
    const job = Array.isArray(data) ? data[0] : data;
    if (!job?.job_id) break;
    processed += 1;
    try {
      if (!validFeature(job.feature) || !validLocale(job.locale))
        throw Object.assign(new Error("Invalid AI job contract"), {
          code: "ai_invalid_job",
        });
      const context: Record<string, string> = {};
      if (job.input_context && typeof job.input_context === "object") {
        for (const [key, value] of Object.entries(job.input_context)) {
          if (typeof value === "string") context[key] = value;
        }
      }
      const completion = await provider.complete({
        feature: job.feature,
        promptVersion: job.prompt_version,
        locale: job.locale,
        context,
      });
      const { error: completeError } = await admin.rpc("complete_ai_job", {
        p_job_id: job.job_id,
        p_status: "completed",
        p_provider: completion.provider,
        p_model: completion.model,
        p_input_tokens: completion.inputTokens,
        p_output_tokens: completion.outputTokens,
        p_cost_micros: completion.costMicros,
        p_output: completion.output,
        p_moderation_status: completion.moderationStatus,
      });
      if (completeError) throw completeError;
    } catch (error) {
      failed += 1;
      await admin.rpc("complete_ai_job", {
        p_job_id: job.job_id,
        p_status: "failed",
        p_error_code: aiErrorCode(error),
      });
    }
  }
  return NextResponse.json({ ok: true, processed, failed });
}
