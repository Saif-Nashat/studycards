import { ImageResponse } from "next/og";

// Generated favicon: modern browsers prefer this PNG over favicon.ico.
// A rounded deep-green tile with the brand "M" — matches the app's logo badge.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #15803d 0%, #0d9488 100%)",
          borderRadius: 14,
          color: "#fff",
          fontSize: 40,
          fontWeight: 700,
        }}
      >
        M
      </div>
    ),
    { ...size }
  );
}
