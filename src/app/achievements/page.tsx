"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Lock, Loader2, Sparkles, ArrowRight,
  Footprints, Layers, Library, Target, Dumbbell, GraduationCap,
  Sunrise, Zap, Flame, CalendarCheck, Rocket, Brain, Crosshair, CalendarDays,
} from "lucide-react";
import {
  evaluateAchievements, totalPoints, TIER_META,
  type AchStats, type EvaluatedAchievement,
} from "@/lib/achievements";
import { ProgressTabs } from "@/components/SectionTabs";

// Map the string icon names in the achievement catalogue to real components.
const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Footprints, Layers, Library, Target, Dumbbell, GraduationCap,
  Sunrise, Zap, Flame, CalendarCheck, Rocket, Brain, Sparkles, Crosshair, CalendarDays,
};

const SEEN_KEY = "sc_trophies_seen";

export default function AchievementsPage() {
  const [stats, setStats] = useState<AchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [justUnlocked, setJustUnlocked] = useState<EvaluatedAchievement[]>([]);

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((s: AchStats) => {
        setStats(s);
        setLoading(false);

        // Celebrate trophies unlocked since the last visit (tracked in localStorage).
        try {
          const evaluated = evaluateAchievements(s);
          const unlockedIds = evaluated.filter((a) => a.unlocked).map((a) => a.id);
          const seen: string[] = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
          const fresh = evaluated.filter((a) => a.unlocked && !seen.includes(a.id));
          if (fresh.length) setJustUnlocked(fresh);
          localStorage.setItem(SEEN_KEY, JSON.stringify(unlockedIds));
        } catch { /* localStorage unavailable — skip the celebration */ }
      })
      .catch(() => setLoading(false));
  }, []);

  const evaluated = useMemo(() => (stats ? evaluateAchievements(stats) : []), [stats]);
  const unlockedCount = evaluated.filter((a) => a.unlocked).length;
  const points = totalPoints(evaluated);

  // The single closest locked trophy — a concrete thing to chase next.
  const nextUp = useMemo(
    () => evaluated
      .filter((a) => !a.unlocked && !a.locked)
      .sort((a, b) => b.pct - a.pct)[0],
    [evaluated]
  );

  if (loading) {
    return <div className="grid place-items-center py-24 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-7">
      <ProgressTabs />
      <div>
        <span className="eyebrow mb-2.5">Milestones</span>
        <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2.5 tracking-tight"><Trophy size={26} strokeWidth={1.75} className="text-[var(--color-gold)]" /> Trophies</h1>
        <p className="text-[var(--color-muted)] mt-1">Earn rewards as you study. Keep your streak alive and unlock them all.</p>
      </div>

      {/* Summary */}
      <div id="tour-trophies" className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="card-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-muted)]">Trophies earned</span>
            <span className="grid place-items-center w-9 h-9 rounded-xl text-[var(--color-gold)]" style={{ background: "color-mix(in srgb, var(--color-gold) 16%, transparent)" }}><Trophy size={18} /></span>
          </div>
          <p className="text-3xl font-bold mt-2 tabular-nums">{unlockedCount} <span className="text-base font-medium text-[var(--color-muted)]">/ {evaluated.length}</span></p>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-muted)]">Trophy points</span>
            <span className="grid place-items-center w-9 h-9 rounded-xl text-[var(--color-brand)]" style={{ background: "color-mix(in srgb, var(--color-brand) 16%, transparent)" }}><Sparkles size={18} /></span>
          </div>
          <p className="text-3xl font-bold mt-2 tabular-nums">{points}</p>
        </div>
        <div className="card-surface p-5 col-span-2 lg:col-span-1">
          <span className="text-sm text-[var(--color-muted)]">Next up</span>
          {nextUp ? (
            <div className="mt-1">
              <p className="font-semibold leading-tight">{nextUp.title}</p>
              <div className="h-2 rounded-full bg-[var(--color-track)] overflow-hidden mt-2">
                <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${nextUp.pct}%` }} />
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-1">{nextUp.current} / {nextUp.goal}</p>
            </div>
          ) : (
            <p className="font-semibold mt-1 text-[var(--color-good)]">All caught up! 🎉</p>
          )}
        </div>
      </div>

      {/* Trophy grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {evaluated.map((a, i) => {
          const Icon = ICONS[a.icon] ?? Trophy;
          const tier = TIER_META[a.tier];
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className={`card-surface p-5 flex gap-4 ${a.unlocked ? "" : "opacity-70"}`}
              style={a.unlocked ? { borderColor: `color-mix(in srgb, ${tier.color} 55%, var(--color-line))` } : undefined}
            >
              <span
                className="grid place-items-center w-12 h-12 rounded-xl shrink-0"
                style={{
                  color: a.unlocked ? "white" : "var(--color-muted)",
                  background: a.unlocked ? tier.color : "var(--color-surface-2)",
                }}
              >
                {a.unlocked ? <Icon size={24} /> : <Lock size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold leading-tight">{a.title}</h3>
                  <span className="chip !text-[0.65rem]" style={{ background: `color-mix(in srgb, ${tier.color} 20%, transparent)`, color: tier.color }}>{tier.label}</span>
                </div>
                <p className="text-sm text-[var(--color-muted)] mt-0.5">{a.description}</p>
                {a.unlocked ? (
                  <p className="text-xs font-semibold mt-2" style={{ color: tier.color }}>✓ Unlocked · +{tier.points} pts</p>
                ) : a.locked ? (
                  <p className="text-xs text-[var(--color-muted)] mt-2">Keep studying to unlock this one.</p>
                ) : (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-[var(--color-track)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: tier.color }} />
                    </div>
                    <p className="text-xs text-[var(--color-muted)] mt-1 tabular-nums">{a.current} / {a.goal}</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="card-surface p-6 text-center">
        <p className="text-[var(--color-muted)]">The best way to earn trophies? Keep a daily habit going.</p>
        <Link href="/study?go=1&mode=due" className="btn btn-primary mt-3">Study now <ArrowRight size={16} /></Link>
      </div>

      {/* New-unlock celebration */}
      <AnimatePresence>
        {justUnlocked.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setJustUnlocked([])}>
            <motion.div initial={{ scale: 0.92, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              className="card-surface gradient-ring p-8 text-center max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <motion.div
                initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
                className="grid place-items-center w-16 h-16 rounded-2xl mx-auto mb-4 text-white pulse-glow"
                style={{ background: "var(--color-gold)" }}
              >
                <Trophy size={30} />
              </motion.div>
              <h2 className="text-2xl font-bold mb-1">
                {justUnlocked.length === 1 ? "Trophy unlocked!" : `${justUnlocked.length} trophies unlocked!`}
              </h2>
              <p className="text-[var(--color-muted)] mb-4">Brilliant work — keep the momentum going.</p>
              <div className="space-y-2 text-left mb-5">
                {justUnlocked.map((a) => {
                  const Icon = ICONS[a.icon] ?? Trophy;
                  const tier = TIER_META[a.tier];
                  return (
                    <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] p-2.5">
                      <span className="grid place-items-center w-9 h-9 rounded-lg text-white shrink-0" style={{ background: tier.color }}><Icon size={18} /></span>
                      <div><p className="font-semibold text-sm leading-tight">{a.title}</p><p className="text-xs text-[var(--color-muted)]">{a.description}</p></div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setJustUnlocked([])} className="btn btn-primary w-full">Nice!</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
