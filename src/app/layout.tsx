import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import StorageBanner from "@/components/StorageBanner";
import Tutorial from "@/components/Tutorial";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudyCards — MRCOG & USMLE Flashcards",
  description: "Your private spaced-repetition flashcard app",
};

// Runs synchronously as the browser parses <head>, before the first paint, so
// the saved (or system-preferred) theme is applied with no flash. See
// next/docs preventing-flash-before-hydration.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full">
        {/* Decorative drifting aurora, painted behind all content. */}
        <div className="aurora" aria-hidden><span className="a1" /><span className="a2" /><span className="a3" /></div>
        <NavBar />
        <StorageBanner />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <Tutorial />
      </body>
    </html>
  );
}
