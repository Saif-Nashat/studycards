"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// Light/dark switch. The actual theme is applied before paint by the inline
// script in the root layout (reading localStorage, falling back to the system
// preference); this button just reflects and flips that choice, persisting it.
export default function ThemeToggle() {
  // Start as null so the server render and first client render match (avoiding a
  // hydration mismatch); the real value is read from the DOM in an effect.
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode / storage unavailable — theme still applies for this session */
    }
    setTheme(next);
  }

  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      className="btn btn-ghost py-2 px-2.5"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Render nothing theme-specific until mounted, so SSR and hydration agree. */}
      {theme === null ? <span className="w-4 h-4" /> : isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
