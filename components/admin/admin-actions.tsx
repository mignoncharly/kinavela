"use client";

import { useState } from "react";

type Action = Record<string, unknown>;

export function AdminActionButton({
  action,
  label,
}: {
  action: Action;
  label: string;
}) {
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
        ? "Working…"
        : state === "error"
          ? "Retry"
          : state === "done"
            ? "Done"
            : label}
    </button>
  );
}

export function FeatureFlagToggle({
  flagKey,
  enabled,
  rolloutPercent,
  description,
}: {
  flagKey: string;
  enabled: boolean;
  rolloutPercent: number;
  description: string;
}) {
  return (
    <AdminActionButton
      action={{
        action: "set_feature_flag",
        flag_key: flagKey,
        enabled: !enabled,
        rollout_percent: rolloutPercent,
        description,
      }}
      label={enabled ? "Disable" : "Enable"}
    />
  );
}
