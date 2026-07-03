// Gamification — trophies that reward studying and give the user something to
// chase. Everything here is *derived* from stats the app already tracks (reviews,
// streaks, card maturity), so there's nothing extra to store: the achievements
// API computes an AchStats snapshot, and this shared definition turns it into a
// list of trophies with unlocked state + progress toward the next tier.

export interface AchStats {
  totalReviews: number;   // all-time card reviews
  streak: number;         // current consecutive-day study streak
  longestStreak: number;  // best-ever streak
  daysStudied: number;    // distinct days with at least one review
  reviewedToday: number;  // reviews so far today
  matureCards: number;    // cards with a 21+ day interval ("stuck")
  totalCards: number;     // cards in the collection
  totalDecks: number;     // decks created
  accuracy: number;       // all-time Good/Easy share, 0–100
}

export type Tier = "bronze" | "silver" | "gold" | "platinum";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;   // lucide-react icon name, resolved on the client
  tier: Tier;
  goal: number;
  // How far along the user is toward `goal`, from a stats snapshot.
  progress: (s: AchStats) => number;
  // Optional gate: some trophies only make sense once there's enough data
  // (e.g. accuracy needs a minimum number of reviews to be meaningful).
  eligible?: (s: AchStats) => boolean;
}

export const TIER_META: Record<Tier, { label: string; color: string; points: number }> = {
  bronze: { label: "Bronze", color: "#b45309", points: 10 },
  silver: { label: "Silver", color: "#64748b", points: 25 },
  gold: { label: "Gold", color: "#d97706", points: 50 },
  platinum: { label: "Platinum", color: "#0d9488", points: 100 },
};

// The trophy catalogue. Grouped loosely by theme; order here is display order.
export const ACHIEVEMENTS: AchievementDef[] = [
  // — Getting going —
  { id: "first-review", title: "First steps", description: "Review your very first card.", icon: "Footprints", tier: "bronze", goal: 1, progress: (s) => s.totalReviews },
  { id: "first-deck", title: "Deck builder", description: "Create or import your first deck.", icon: "Layers", tier: "bronze", goal: 1, progress: (s) => s.totalDecks },
  { id: "fifty-cards", title: "Collector", description: "Have 50 cards in your collection.", icon: "Library", tier: "bronze", goal: 50, progress: (s) => s.totalCards },

  // — Total reviews —
  { id: "reviews-100", title: "Century", description: "Review 100 cards in total.", icon: "Target", tier: "silver", goal: 100, progress: (s) => s.totalReviews },
  { id: "reviews-500", title: "Dedicated", description: "Review 500 cards in total.", icon: "Dumbbell", tier: "gold", goal: 500, progress: (s) => s.totalReviews },
  { id: "reviews-2000", title: "Scholar", description: "Review 2,000 cards in total.", icon: "GraduationCap", tier: "platinum", goal: 2000, progress: (s) => s.totalReviews },

  // — Daily volume —
  { id: "today-20", title: "Warm-up", description: "Review 20 cards in a single day.", icon: "Sunrise", tier: "bronze", goal: 20, progress: (s) => s.reviewedToday },
  { id: "today-100", title: "Power session", description: "Review 100 cards in a single day.", icon: "Zap", tier: "gold", goal: 100, progress: (s) => s.reviewedToday },

  // — Streaks —
  { id: "streak-3", title: "On a roll", description: "Study 3 days in a row.", icon: "Flame", tier: "bronze", goal: 3, progress: (s) => Math.max(s.streak, s.longestStreak) },
  { id: "streak-7", title: "Consistent", description: "Study 7 days in a row.", icon: "CalendarCheck", tier: "silver", goal: 7, progress: (s) => Math.max(s.streak, s.longestStreak) },
  { id: "streak-30", title: "Unstoppable", description: "Study 30 days in a row.", icon: "Rocket", tier: "platinum", goal: 30, progress: (s) => Math.max(s.streak, s.longestStreak) },

  // — Mastery —
  { id: "mature-25", title: "Memory maker", description: "Get 25 cards to a 21+ day interval.", icon: "Brain", tier: "silver", goal: 25, progress: (s) => s.matureCards },
  { id: "mature-200", title: "Mind palace", description: "Get 200 cards to a 21+ day interval.", icon: "Sparkles", tier: "platinum", goal: 200, progress: (s) => s.matureCards },

  // — Quality —
  { id: "accuracy-80", title: "Sharpshooter", description: "Reach 80% Good/Easy accuracy (after 50+ reviews).", icon: "Crosshair", tier: "gold", goal: 80, progress: (s) => s.accuracy, eligible: (s) => s.totalReviews >= 50 },

  // — Commitment —
  { id: "days-30", title: "Regular", description: "Study on 30 different days.", icon: "CalendarDays", tier: "gold", goal: 30, progress: (s) => s.daysStudied },
];

export interface EvaluatedAchievement extends AchievementDef {
  current: number;
  unlocked: boolean;
  pct: number; // 0–100 progress toward the goal
  locked: boolean; // not yet eligible to earn (gated)
}

// Turn a stats snapshot into fully-evaluated trophies.
export function evaluateAchievements(stats: AchStats): EvaluatedAchievement[] {
  return ACHIEVEMENTS.map((a) => {
    const eligible = a.eligible ? a.eligible(stats) : true;
    const current = Math.min(a.progress(stats), a.goal);
    const unlocked = eligible && a.progress(stats) >= a.goal;
    const pct = a.goal > 0 ? Math.min(100, Math.round((current / a.goal) * 100)) : 0;
    return { ...a, current, unlocked, pct, locked: !eligible };
  });
}

// Total "trophy points" earned, for a headline number.
export function totalPoints(evaluated: EvaluatedAchievement[]): number {
  return evaluated.filter((a) => a.unlocked).reduce((sum, a) => sum + TIER_META[a.tier].points, 0);
}
