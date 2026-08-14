import { ImageResponse } from "next/og";

export const alt = "Kinavela — keep roots alive, create closeness";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Locale-neutral brand card. Lives at the app root so every route inherits it,
// including the non-localized legal pages.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f8f3ea",
          color: "#26352e",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 34,
            letterSpacing: "0.28em",
            fontWeight: 700,
          }}
        >
          KINAVELA
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.15 }}>
            Keep roots alive.
          </div>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.15 }}>
            Create closeness.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            fontSize: 30,
            color: "#6d746e",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "72px",
              height: "8px",
              background: "#9f4334",
              borderRadius: "999px",
            }}
          />
          kinavela.com
        </div>
      </div>
    ),
    size,
  );
}
