"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, BookOpen, Flame, Layers, Upload, Settings, LogOut, GraduationCap, BarChart3, NotebookPen, Trophy } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/hard", label: "Hard cards", icon: Flame },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/achievements", label: "Trophies", icon: Trophy },
  { href: "/notebook", label: "Notebook", icon: NotebookPen },
  { href: "/browse", label: "Browse", icon: Layers },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") return null;

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-[var(--color-nav)] border-b border-[var(--color-line)]">
      {/* A roomy header: the row wraps onto a second line when space runs out,
          so every section stays visible — no horizontal slider. */}
      <div className="mx-auto max-w-[88rem] px-4 min-h-16 py-2 flex items-center gap-2 flex-wrap">
        <Link href="/" className="flex items-center gap-2 mr-3 font-bold text-lg">
          <span className="logo-badge grid place-items-center w-9 h-9 rounded-xl text-white">
            <GraduationCap size={20} />
          </span>
          <span className="hidden sm:inline">StudyCards</span>
        </Link>

        <nav className="flex items-center gap-1 flex-wrap order-last w-full lg:order-none lg:w-auto lg:flex-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition
                  ${active ? "text-white" : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"}`}
              >
                {/* The active pill glides between links instead of jumping. */}
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-[var(--color-brand)] shadow"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon size={16} className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <button onClick={logout} className="btn btn-ghost py-2 px-3 text-sm" title="Log out">
            <LogOut size={16} />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
