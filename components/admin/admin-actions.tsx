"use client";

import { getAdminCopy } from "@/lib/i18n/app-copy";
import type { Locale } from "@/lib/i18n/config";
import { useState } from "react";

type Action = Record<string, unknown>;

export function AdminActionButton({
  action,
  label,
  locale,
}: {
  action: Action;
  label: string;
  locale: Locale;
}) {
  const copy = getAdminCopy(locale);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  async function submit() {
    setState("busy");
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      setState(response.ok ? "done" : "error");
      if (response.ok) window.location.reload();
    } catch {
      setState("error");
    }
  }
  return (
    <button
      className="admin-action"
      disabled={state === "busy"}
      onClick={submit}
    >
      {state === "busy"
        ? copy.working
        : state === "error"
          ? copy.retry
          : state === "done"
            ? copy.done
            : label}
    </button>
  );
}

export function FeatureFlagToggle({
  flagKey,
  enabled,
  rolloutPercent,
  description,
  locale,
}: {
  flagKey: string;
  enabled: boolean;
  rolloutPercent: number;
  description: string;
  locale: Locale;
}) {
  const copy = getAdminCopy(locale);
  return (
    <AdminActionButton
      action={{
        action: "set_feature_flag",
        flag_key: flagKey,
        enabled: !enabled,
        rollout_percent: rolloutPercent,
        description,
      }}
      locale={locale}
      label={enabled ? copy.disable : copy.enable}
    />
  );
}

export function AdminReportControls({
  reportId,
  targetEventId,
  targetSupportPostId,
  locale,
}: {
  reportId: string;
  targetEventId: string | null;
  targetSupportPostId: string | null;
  locale: Locale;
}) {
  const copy = getAdminCopy(locale);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("busy");
    const form = new FormData(event.currentTarget);
    const operation = String(form.get("operation"));
    const note = String(form.get("note") ?? "").trim();
    const severity = String(form.get("severity") ?? "");
    const response = await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "manage_report",
        report_id: reportId,
        operation,
        ...(severity ? { severity } : {}),
        ...(note ? { note } : {}),
      }),
    });
    if (response.ok) window.location.reload();
    else setState("error");
  }
  return (
    <form className="admin-report-controls" onSubmit={submit}>
      <select name="operation" defaultValue="assign_to_me">
        <option value="assign_to_me">{copy.assignToMe}</option>
        <option value="add_note">{copy.addReviewNote}</option>
        <option value="set_severity">{copy.changeSeverity}</option>
        {targetEventId && (
          <option value="cancel_event">{copy.cancelEvent}</option>
        )}
        {targetEventId && (
          <option value="restrict_event">{copy.restrictEvent}</option>
        )}
        {targetSupportPostId && (
          <option value="delete_support_content">
            {copy.removeSupportContent}
          </option>
        )}
        <option value="resolve">{copy.resolve}</option>
        <option value="dismiss">{copy.dismiss}</option>
      </select>
      <select name="severity" defaultValue="">
        <option value="">{copy.keepSeverity}</option>
        <option value="low">{copy.low}</option>
        <option value="medium">{copy.medium}</option>
        <option value="high">{copy.high}</option>
        <option value="critical">{copy.critical}</option>
      </select>
      <textarea
        name="note"
        maxLength={1000}
        rows={2}
        placeholder={copy.reportNotePlaceholder}
      />
      <button className="admin-action" disabled={state === "busy"}>
        {state === "busy"
          ? copy.working
          : state === "error"
            ? copy.retry
            : copy.apply}
      </button>
    </form>
  );
}

export function VerificationReviewControls({
  requestId,
  locale,
}: {
  requestId: string;
  locale: Locale;
}) {
  const copy = getAdminCopy(locale);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  async function review(approve: boolean, note: string) {
    setState("busy");
    const response = await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "review_verification",
        request_id: requestId,
        approve,
        note,
      }),
    });
    if (response.ok) window.location.reload();
    else setState("error");
  }
  return (
    <form
      className="admin-report-controls"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void review(
          String(form.get("decision")) === "approve",
          String(form.get("note") ?? ""),
        );
      }}
    >
      <select name="decision" defaultValue="approve">
        <option value="approve">{copy.approve}</option>
        <option value="reject">{copy.reject}</option>
      </select>
      <textarea
        name="note"
        minLength={2}
        maxLength={500}
        rows={2}
        required
        placeholder={copy.verificationNotePlaceholder}
      />
      <button className="admin-action" disabled={state === "busy"}>
        {state === "busy"
          ? copy.working
          : state === "error"
            ? copy.retry
            : copy.review}
      </button>
    </form>
  );
}
