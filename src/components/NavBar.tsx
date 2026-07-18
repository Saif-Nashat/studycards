"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, BookOpen, Flame, Layers, Settings, LogOut, GraduationCap, BarChart3, NotebookPen, Menu, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  const isActive = (href: string, match?: string[]) =>
    href === "/" ? pathname === "/" : (match ?? [href]).some((m) => pathname.startsWith(m));

  // The menu closes itself on every navigation (each link/Log out calls
  // setOpen(false) on click) and on tapping the backdrop; this also lets Escape
  // dismiss it, so it never traps the user on a phone.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === "/login") return null;

  async function logout() {
    setOpen(false);
    await fetch("/api/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
      {/* A floating glass island, detached from the edges. From md up the seven
          entries render inline (icon-only until lg, then labelled). Below md
          they'd overflow a phone, so they collapse behind a hamburger menu. */}
      <div className="nav-island mx-auto max-w-[88rem] rounded-[1.6rem] px-2.5 sm:px-4 min-h-14 py-2 flex items-center gap-1.5 sm:gap-2">
        <Link href="/" aria-label="MediCards home" className="flex items-center gap-2.5 mr-1 sm:mr-3 font-bold text-lg group shrink-0">
          <span className="logo-badge grid place-items-center w-9 h-9 rounded-xl text-white">
            <GraduationCap size={19} />
          </span>
          {/* Wordmark waits until xl so the page names have room to fit on one
              line at lg (laptops / landscape iPad). On phones there's no inline
              nav competing for room, so it can show there too. */}
          <span className="inline md:hidden xl:inline tracking-tight">MediCards</span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 flex-1 min-w-0 justify-center lg:justify-start">
          {LINKS.map(({ href, label, icon: Icon, match }) => {
            const active = isActive(href, match);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className={`relative flex items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-colors duration-300
                  w-10 h-10 lg:w-auto lg:h-auto lg:px-3 lg:py-2
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
          <button onClick={logout} className="hidden md:flex btn btn-ghost py-2 px-2.5 sm:px-3 text-sm" title="Log out" aria-label="Log out">
            <LogOut size={15} strokeWidth={1.75} />
            <span className="hidden sm:inline">Log out</span>
          </button>
          {/* Phone-only menu toggle. */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="md:hidden grid place-items-center w-10 h-10 rounded-full text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Phone dropdown menu — the seven links plus Log out, full-width and
          comfortably tappable. */}
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              key="nav-backdrop"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="md:hidden fixed inset-0 z-10 cursor-default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: "color-mix(in srgb, var(--color-bg) 45%, transparent)" }}
            />
            <motion.div
              key="nav-menu"
              className="md:hidden relative z-20 mx-auto max-w-[88rem] mt-2 card-surface rounded-2xl p-2"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              <nav className="flex flex-col gap-0.5">
                {LINKS.map(({ href, label, icon: Icon, match }) => {
                  const active = isActive(href, match);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3.5 h-12 text-[15px] font-medium transition-colors
                        ${active ? "bg-[var(--color-brand)] text-white" : "text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"}`}
                    >
                      <Icon size={19} strokeWidth={1.75} className="shrink-0" />
                      {label}
                    </Link>
                  );
                })}
                <div className="my-1 h-px bg-[var(--color-hairline)]" />
                <button
                  onClick={logout}
                  className="flex items-center gap-3 rounded-xl px-3.5 h-12 text-[15px] font-medium text-[var(--color-again)] hover:bg-[var(--color-danger-bg)] transition-colors"
                >
                  <LogOut size={19} strokeWidth={1.75} className="shrink-0" />
                  Log out
                </button>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
