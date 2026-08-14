"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Locale } from "@/lib/i18n/config";
import type { AppDictionary } from "@/lib/i18n/app-copy";

import { clearOfflineSnapshots } from "@/components/pwa/offline-data";

export function LogoutButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  return (
    <button
      className="button button-secondary"
      onClick={async () => {
        await clearOfflineSnapshots().catch(() => undefined);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push(`/${locale}`);
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function DeletionButton({ copy }: { copy: AppDictionary["settings"] }) {
  const [state, setState] = useState("");
  return (
    <div>
      <button
        className="button danger-button"
        onClick={async () => {
          if (!window.confirm(copy.deleteConfirm)) return;
          const response = await fetch("/api/account/deletion", {
            method: "POST",
          });
          setState(response.ok ? copy.deleteSuccess : copy.deleteFailed);
        }}
      >
        {copy.deleteButton}
      </button>
      {state && <p role="status">{state}</p>}
    </div>
  );
}
