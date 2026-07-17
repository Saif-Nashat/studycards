import type { MetadataRoute } from "next";

// Web app manifest — makes MediCards installable to a phone/desktop home screen
// as a standalone app (its own window, no browser chrome). Next serves this at
// /manifest.webmanifest and links it automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MediCards — Spaced-Repetition Flashcards",
    short_name: "MediCards",
    description:
      "Study smarter with spaced repetition: import Anki decks or your own notes, build custom tests, and track your streak.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050a07",
    theme_color: "#0d9488",
    categories: ["education", "medical", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
