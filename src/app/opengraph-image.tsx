import { ImageResponse } from "next/og";

// The card shown when a MediCards link is shared (WhatsApp, iMessage,
// Twitter/X, Discord…). Generated at build time — no image asset to maintain.
export const alt = "MediCards — spaced-repetition flashcards that make facts stick";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #050a07 0%, #0e2016 55%, #14532d 100%)",
          color: "#e6f2e9",
          fontSize: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              width: 110,
              height: 110,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #15803d 0%, #0d9488 100%)",
              borderRadius: 28,
              color: "#fff",
              fontSize: 64,
              fontWeight: 700,
            }}
          >
            M
          </div>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: "#ffffff" }}>
            MediCards
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 36,
            color: "#9fc4ab",
            textAlign: "center",
          }}
        >
          Spaced-repetition flashcards that make facts stick
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 26,
            color: "#6d8f7a",
          }}
        >
          Import Anki decks · Build custom tests · Track your streak
        </div>
      </div>
    ),
    { ...size }
  );
}
