"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, BookOpen, Flame, Layers, Upload, Settings, LogOut, GraduationCap, BarChart3, NotebookPen } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/hard", label: "Hard cards", icon: Flame },
  { href: "/insights", label: "Insights", icon: BarChart3 },
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
    <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-[var(--color-line)]">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 mr-2 font-bold text-lg">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-[var(--color-brand)] text-white shadow">
            <GraduationCap size={20} />
          </span>
          <span className="hidden sm:inline">StudyCards</span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition
                  ${active ? "bg-[var(--color-brand)] text-white shadow" : "text-[var(--color-muted)] hover:bg-[#eef0fa] hover:text-[var(--color-ink)]"}`}
              >
                <Icon size={16} />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <button onClick={logout} className="ml-auto btn btn-ghost py-2 px-3 text-sm" title="Log out">
          <LogOut size={16} />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}
