"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          background: "#f8f4ea",
          color: "#1f2b24",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
        }}
      >
        <main
          style={{
            display: "grid",
            minHeight: "100vh",
            placeItems: "center",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div>
            <h1>Etwas ist schiefgegangen</h1>
            <p>Une erreur est survenue · Something went wrong</p>
            <button
              onClick={retry}
              style={{
                background: "#1f2b24",
                border: 0,
                borderRadius: "999px",
                color: "white",
                cursor: "pointer",
                padding: "0.8rem 1.2rem",
              }}
              type="button"
            >
              Erneut versuchen · Réessayer · Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
