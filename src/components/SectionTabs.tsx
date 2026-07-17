"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, Trophy, Layers, Upload } from "lucide-react";

// A small segmented tab bar used to switch between the two pages that make up a
// merged nav section: Insights ⇄ Trophies, and Browse ⇄ Import. Each tab is a
// real route link (so deep links and the back button keep working), and the
// active pill glides between them. `layoutId` is namespaced per bar so the two
// bars never animate into each other.
interface Tab { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; }

function TabBar({ tabs, layoutId }: { tabs: Tab[]; layoutId: string }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 p-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] w-fit mb-6">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-300
              ${active ? "text-white" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-[var(--color-brand)]"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 6px 16px -6px var(--shadow-glow)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon size={15} className="relative z-10" />
            <span className="relative z-10">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function ProgressTabs() {
  return (
    <TabBar
      layoutId="progress-tab-pill"
      tabs={[
        { href: "/insights", label: "Insights", icon: BarChart3 },
        { href: "/achievements", label: "Trophies", icon: Trophy },
      ]}
    />
  );
}

export function LibraryTabs() {
  return (
    <TabBar
      layoutId="library-tab-pill"
      tabs={[
        { href: "/browse", label: "Browse", icon: Layers },
        { href: "/import", label: "Import", icon: Upload },
      ]}
    />
  );
}
