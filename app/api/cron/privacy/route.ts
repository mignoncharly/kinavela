import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret =
    serverEnv.PRIVACY_RETENTION_CRON_SECRET ||
    serverEnv.EVENT_REMINDER_CRON_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer /, "");
  if (!supplied || secret.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(supplied));
}

export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const summary = { exports: 0, deletions: 0, retention: false };
  const { data: expiredStoryMedia } = await admin.rpc(
    "claim_expired_story_media",
  );
  for (const item of expiredStoryMedia ?? []) {
    if (item?.bucket && item?.path)
      await admin.storage.from(item.bucket).remove([item.path]);
  }
  const { data: expiredExports } = await admin.rpc(
    "claim_expired_privacy_export_paths",
  );
  for (const item of expiredExports ?? []) {
    if (item?.path)
      await admin.storage.from("privacy-exports").remove([item.path]);
  }
  const { data: exportClaim } = await admin.rpc("claim_personal_data_export");
  const exportRow = Array.isArray(exportClaim) ? exportClaim[0] : exportClaim;
  if (exportRow?.export_id && exportRow.profile_id) {
    const { data: payload, error: payloadError } = await admin.rpc(
      "get_personal_data_export_payload",
      { p_profile_id: exportRow.profile_id },
    );
    const exportPath = `${exportRow.profile_id}/${exportRow.export_id}.json`;
    if (!payloadError) {
      const upload = await admin.storage
        .from("privacy-exports")
        .upload(exportPath, JSON.stringify(payload, null, 2), {
          contentType: "application/json",
          upsert: true,
        });
      if (!upload.error) {
        await admin.rpc("complete_personal_data_export", {
          p_export_id: exportRow.export_id,
          p_file_path: exportPath,
        });
        summary.exports = 1;
      } else
        await admin.rpc("fail_personal_data_export", {
          p_export_id: exportRow.export_id,
          p_error_code: "export_upload_failed",
        });
    } else
      await admin.rpc("fail_personal_data_export", {
        p_export_id: exportRow.export_id,
        p_error_code: "export_payload_failed",
      });
  }
  const { data: deletionClaim } = await admin.rpc("claim_account_deletion");
  const deletionRow = Array.isArray(deletionClaim)
    ? deletionClaim[0]
    : deletionClaim;
  if (deletionRow?.request_id) {
    const paths = Array.isArray(deletionRow.media_paths)
      ? deletionRow.media_paths
      : [];
    for (const item of paths)
      if (item?.bucket && item?.path)
        await admin.storage.from(item.bucket).remove([item.path]);
    await admin.rpc("anonymize_account_deletion", {
      p_request_id: deletionRow.request_id,
    });
    if (deletionRow.auth_user_id)
      await admin.auth.admin.updateUserById(deletionRow.auth_user_id, {
        email: "deleted+" + deletionRow.auth_user_id + "@invalid.kinavela",
        user_metadata: {},
        app_metadata: {},
        ban_duration: "876000h",
      });
    summary.deletions = 1;
  }
  const { error: retentionError } = await admin.rpc("run_gdpr_retention");
  summary.retention = !retentionError;
  return NextResponse.json(
    { ok: summary.retention, ...summary },
    { status: summary.retention ? 200 : 503 },
  );
}
