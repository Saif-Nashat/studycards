import type { Metadata, Viewport } from "next";
import { Geist, Fraunces, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import StorageBanner from "@/components/StorageBanner";
import Tutorial from "@/components/Tutorial";
import Spotlight from "@/components/Spotlight";
import ImportStatusPill from "@/components/ImportStatusPill";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// High-contrast variable serif for hero headings — the editorial, expensive
// counterpart to Geist's clean UI sans.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

// Geist and Fraunces only cover Latin script; this fills in Arabic glyphs.
// preload:false + the arabic unicode-range means the font file is only
// downloaded on pages that actually render Arabic text.
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  preload: false,
});

// Vercel injects the production domain; locally we fall back to localhost.
// metadataBase turns every relative OG/twitter image path into an absolute URL.
const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(prodUrl),
  title: {
    default: "MediCards — Spaced-Repetition Flashcards That Make Facts Stick",
    template: "%s · MediCards",
  },
  description:
    "Study smarter with spaced repetition: import Anki decks or your own notes, build custom tests, and track your streak. Medicine, languages, law — any subject, any language.",
  applicationName: "MediCards",
  keywords: [
    "flashcards", "spaced repetition", "Anki import", "study app",
    "USMLE", "MRCOG", "medical flashcards", "exam prep",
  ],
  openGraph: {
    type: "website",
    siteName: "MediCards",
    title: "MediCards — Spaced-Repetition Flashcards That Make Facts Stick",
    description:
      "Import Anki decks or your own notes, build custom tests, and track your streak. Any subject, any language.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "MediCards — Spaced-Repetition Flashcards",
    description:
      "Import Anki decks or your own notes, build custom tests, and track your streak.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#050a07" },
  ],
};

// Runs synchronously as the browser parses <head>, before the first paint, so
// the saved (or system-preferred) theme is applied with no flash. See
// next/docs preventing-flash-before-hydration.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${geistSans.variable} ${fraunces.variable} ${notoArabic.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full">
        {/* Decorative atmosphere: drifting aurora behind everything, film grain
            above everything — both fixed and pointer-transparent. */}
        <div className="aurora" aria-hidden><span className="a1" /><span className="a2" /><span className="a3" /></div>
        <div className="grain" aria-hidden />
        <Spotlight />
        <NavBar />
        <StorageBanner />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <Tutorial />
        {/* Deck imports keep running across page changes; this shows their progress. */}
        <ImportStatusPill />
      </body>
    </html>
  );
}
