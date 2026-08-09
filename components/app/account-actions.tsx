"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Locale } from "@/lib/i18n/config";

export function LogoutButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  return (
    <button
      className="button button-secondary"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push(`/${locale}`);
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function DeletionButton() {
  const [state, setState] = useState("");
  return (
    <div>
      <button
        className="button danger-button"
        onClick={async () => {
          if (
            !window.confirm(
              "Request account deletion? Your request will enter the protected deletion workflow.",
            )
          )
            return;
          const response = await fetch("/api/account/deletion", {
            method: "POST",
          });
          setState(
            response.ok
              ? "Deletion request received."
              : "Could not create request.",
          );
        }}
      >
        Request account deletion
      </button>
      {state && <p role="status">{state}</p>}
    </div>
  );
}
