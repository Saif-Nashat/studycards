"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, BookOpen, Flame, Layers, Settings, LogOut, GraduationCap, BarChart3, NotebookPen } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

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
      {/* A floating glass island, detached from the edges. Below lg the nav is
          icon-only so the whole bar fits one line on a phone; from lg up each
          entry shows its name too, so the wider bar doesn't look sparse. Names
          also live in title/aria-label for the icon-only sizes. */}
      <div className="nav-island mx-auto max-w-[88rem] rounded-[1.6rem] px-2.5 sm:px-4 min-h-14 py-2 flex items-center gap-1.5 sm:gap-2">
        <Link href="/" aria-label="MediCards home" className="flex items-center gap-2.5 mr-1 sm:mr-3 font-bold text-lg group shrink-0">
          <span className="logo-badge grid place-items-center w-9 h-9 rounded-xl text-white">
            <GraduationCap size={19} />
          </span>
          {/* Wordmark waits until xl so the page names have room to fit on one
              line at lg (laptops / landscape iPad). */}
          <span className="hidden xl:inline tracking-tight">MediCards</span>
        </Link>

        <nav className="flex items-center gap-0.5 flex-1 min-w-0 justify-center lg:justify-start">
          {LINKS.map(({ href, label, icon: Icon, match }) => {
            const active = href === "/"
              ? pathname === "/"
              : (match ?? [href]).some((m) => pathname.startsWith(m));
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className={`relative flex items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-colors duration-300
                  w-9 h-9 sm:w-10 sm:h-10 lg:w-auto lg:h-auto lg:px-3 lg:py-2
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
                <Icon size={17} className="relative z-10 shrink-0" strokeWidth={1.75} />
                <span className="relative z-10 hidden lg:inline text-sm font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
          <ThemeToggle />
          <button onClick={logout} className="btn btn-ghost py-2 px-2.5 sm:px-3 text-sm" title="Log out" aria-label="Log out">
            <LogOut size={15} strokeWidth={1.75} />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
