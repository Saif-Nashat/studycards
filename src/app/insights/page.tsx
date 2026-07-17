"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart3, Flame, CalendarCheck, Target, Loader2, Layers, TrendingUp } from "lucide-react";
import NumberTicker from "@/components/NumberTicker";

interface Insights {
  totalReviews: number;
  today: number;
  last7: number;
  accuracy: number;
  streak: number;
  ratingCounts: { again: number; hard: number; good: number; easy: number };
  daily: { date: string; label: string; count: number }[];
  maturity: { total: number; new: number; learning: number; review: number; mature: number };
}

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/insights").then((r) => r.json()).then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) {
    return <div className="grid place-items-center py-24 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>;
  }

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.count));
  const ratings = [
    { label: "Again", value: data.ratingCounts.again, color: "var(--color-again)" },
    { label: "Hard", value: data.ratingCounts.hard, color: "var(--color-hard)" },
    { label: "Good", value: data.ratingCounts.good, color: "var(--color-good)" },
    { label: "Easy", value: data.ratingCounts.easy, color: "var(--color-easy)" },
  ];
  const totalRated = ratings.reduce((s, r) => s + r.value, 0);
  const pct = (n: number) => (totalRated ? Math.round((n / totalRated) * 100) : 0);

  const topCards = [
    { label: "Day streak", value: data.streak, suffix: data.streak === 1 ? "day" : "days", icon: Flame, color: "var(--color-hard)" },
    { label: "Reviewed today", value: data.today, icon: CalendarCheck, color: "var(--color-brand)" },
    { label: "Last 7 days", value: data.last7, icon: TrendingUp, color: "var(--color-accent)" },
    { label: "All-time accuracy", value: `${data.accuracy}%`, icon: Target, color: "var(--color-good)" },
  ];

  const mat = data.maturity;
  const matSegs = [
    { label: "New", value: mat.new, color: "var(--color-accent)" },
    { label: "Learning", value: mat.learning, color: "var(--color-hard)" },
    { label: "Maturing", value: mat.review - mat.mature, color: "#a78bfa" },
    { label: "Mature (21d+)", value: mat.mature, color: "var(--color-good)" },
  ];

  return (
    <div className="space-y-7">
      <div>
        <span className="eyebrow mb-2.5">Performance</span>
        <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2.5 tracking-tight"><BarChart3 size={26} strokeWidth={1.75} className="text-[var(--color-brand)]" /> My insights</h1>
        <p className="text-[var(--color-muted)] mt-1">Track your revision progress over time.</p>
      </div>

      {/* Top stats */}
      <div id="tour-insights" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {topCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-surface card-lift p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-muted)]">{s.label}</span>
              <span className="grid place-items-center w-9 h-9 rounded-xl" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 16%, transparent)` }}>
                <s.icon size={18} />
              </span>
            </div>
            <p className="text-3xl font-bold mt-2 tabular-nums tracking-tight"><NumberTicker value={s.value} /> {"suffix" in s && s.suffix ? <span className="text-base font-medium text-[var(--color-muted)]">{s.suffix}</span> : null}</p>
          </motion.div>
        ))}
      </div>

      {data.totalReviews === 0 ? (
        <div className="card-surface p-10 text-center text-[var(--color-muted)]">
          No review history yet. <Link href="/study" className="text-[var(--color-brand)] font-medium">Study some cards</Link> and your stats will appear here.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Daily activity */}
          <div className="card-surface p-6">
            <h2 className="font-bold mb-4 flex items-center gap-2"><CalendarCheck size={18} /> Cards reviewed (last 14 days)</h2>
            <div className="flex items-end justify-between gap-1.5 h-40">
              {data.daily.map((d, i) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="relative w-full flex items-end justify-center" style={{ height: "100%" }}>
                    <motion.div
                      className="w-full max-w-[22px] rounded-t-md bg-[var(--color-brand)]"
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.count / maxDaily) * 100}%` }}
                      transition={{ delay: i * 0.03, duration: 0.5 }}
                      title={`${d.count} on ${d.date}`}
                    />
                    {d.count > 0 && (
                      <span className="absolute -top-5 text-[10px] font-semibold text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition">{d.count}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--color-muted)]">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rating breakdown */}
          <div className="card-surface p-6">
            <h2 className="font-bold mb-4 flex items-center gap-2"><Target size={18} /> How you rated cards</h2>
            <div className="space-y-3.5">
              {ratings.map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{r.label}</span>
                    <span className="text-[var(--color-muted)]">{r.value} · {pct(r.value)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[var(--color-track)] overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: r.color }} initial={{ width: 0 }} animate={{ width: `${pct(r.value)}%` }} transition={{ duration: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-[var(--color-muted)] mt-4">
              {data.totalReviews} total reviews. A higher Good/Easy share means better recall. 💪
            </p>
          </div>

          {/* Card maturity */}
          <div className="card-surface p-6 lg:col-span-2">
            <h2 className="font-bold mb-1 flex items-center gap-2"><Layers size={18} /> Your collection ({mat.total} cards)</h2>
            <p className="text-sm text-[var(--color-muted)] mb-4">How well-learned your cards are. &quot;Mature&quot; cards have an interval of 21+ days — they&apos;re sticking.</p>
            <div className="flex h-5 rounded-full overflow-hidden mb-4 bg-[var(--color-track)]">
              {matSegs.map((s) => s.value > 0 && (
                <motion.div key={s.label} style={{ background: s.color }} initial={{ width: 0 }}
                  animate={{ width: `${(s.value / Math.max(1, mat.total)) * 100}%` }} transition={{ duration: 0.6 }} title={`${s.label}: ${s.value}`} />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {matSegs.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                  <span className="text-sm"><b>{s.value}</b> <span className="text-[var(--color-muted)]">{s.label}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
