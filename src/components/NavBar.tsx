"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, BookOpen, Flame, Layers, Settings, LogOut, GraduationCap, BarChart3, NotebookPen } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import HelpCenter from "./HelpCenter";

// `match` lets one nav entry own several routes: Insights covers the Trophies
// tab, Cards covers the Import tab. The entry stays highlighted on either route,
// while the in-page tab bar switches between them.
const LINKS: { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>; match?: string[] }[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/hard", label: "Hard/flagged", icon: Flame },
  { href: "/insights", label: "Insights", icon: BarChart3, match: ["/insights", "/achievements"] },
  { href: "/notebook", label: "Notebook", icon: NotebookPen },
  { href: "/browse", label: "Cards", icon: Layers, match: ["/browse", "/import"] },
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
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
      {/* A floating glass island, detached from the edges. The row wraps onto a
          second line when space runs out, so every section stays visible. */}
      <div className="nav-island mx-auto max-w-[88rem] rounded-[1.6rem] px-3 sm:px-4 min-h-14 py-2 flex items-center gap-2 flex-wrap">
        <Link href="/" className="flex items-center gap-2.5 mr-3 font-bold text-lg group">
          <span className="logo-badge grid place-items-center w-9 h-9 rounded-xl text-white">
            <GraduationCap size={19} />
          </span>
          <span className="hidden sm:inline tracking-tight">MediCards</span>
        </Link>

        <nav className="flex items-center gap-0.5 flex-wrap order-last w-full lg:order-none lg:w-auto lg:flex-1">
          {LINKS.map(({ href, label, icon: Icon, match }) => {
            const active = href === "/"
              ? pathname === "/"
              : (match ?? [href]).some((m) => pathname.startsWith(m));
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-300
                  ${active ? "text-white" : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"}`}
              >
                {/* The active pill glides between links instead of jumping. */}
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-[var(--color-brand)]"
                    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 6px 16px -6px var(--shadow-glow)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon size={15} className="relative z-10" strokeWidth={1.75} />
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
          {/* Sits right after Settings; opens page-specific help for wherever
              the user currently is. */}
          <HelpCenter />
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <button onClick={logout} className="btn btn-ghost py-2 px-3 text-sm" title="Log out">
            <LogOut size={15} strokeWidth={1.75} />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
