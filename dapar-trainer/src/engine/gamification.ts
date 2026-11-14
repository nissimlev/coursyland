import type { Difficulty, Topic } from '../questions/types';

// ---------- XP ----------

export const XP_PER_CORRECT: Record<Difficulty, number> = { easy: 10, medium: 15, hard: 20 };
export const XP_SESSION_BONUS = 20;
export const XP_PERFECT_BONUS = 30;
export const XP_SIMULATION_BONUS = 100;

/** XP מצטבר שדרוש כדי להגיע לרמה n (רמה 1 = 0) */
export function xpForLevel(n: number): number {
  return 50 * (n - 1) * n;
}

export function levelFromXp(xp: number): number {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

const RANKS = ['טירון', 'טוראי', 'רב״ט', 'סמל', 'סמ״ר', 'רס״ל', 'רס״ר', 'רס״מ', 'רס״ב', 'רנ״ג'];

export function rankName(level: number): string {
  return level <= RANKS.length ? RANKS[level - 1] : `${RANKS[RANKS.length - 1]} ⭐${level - RANKS.length}`;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, rank: rankName(level), into: xp - from, span: to - from, pct: Math.round(((xp - from) / (to - from)) * 100) };
}

// ---------- רצף ימים ----------

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface Streak {
  current: number;
  best: number;
  lastDay: string | null;
}

export function updateStreak(s: Streak, now: number): Streak {
  const today = dayKey(now);
  if (s.lastDay === today) return s;
  const yesterday = dayKey(now - 86_400_000);
  const current = s.lastDay === yesterday ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), lastDay: today };
}

/** רצף "חי": אם היום האחרון היה לפני יותר מיום, הרצף נשבר */
export function liveStreak(s: Streak, now: number): number {
  if (!s.lastDay) return 0;
  return s.lastDay === dayKey(now) || s.lastDay === dayKey(now - 86_400_000) ? s.current : 0;
}

// ---------- תגים ----------

export interface BadgeContext {
  totalAnswered: number;
  hardCorrect: number;
  topicsPracticed: Set<Topic>;
  streakDays: number;
  mistakesCleared: number;
  simulations: number;
  bestSimulation: number;
  /** הסשן האחרון */
  session: { total: number; correct: number; avgTimeMs: number; bestRun: number; isSimulation: boolean };
}

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  test: (c: BadgeContext) => boolean;
}

export const BADGES: Badge[] = [
  { id: 'first-steps', emoji: '🚀', name: 'צעד ראשון', description: 'סיימת את התרגול הראשון', test: () => true },
  { id: 'run-10', emoji: '🔥', name: 'על הגל', description: '10 תשובות נכונות ברצף בתרגול אחד', test: (c) => c.session.bestRun >= 10 },
  { id: 'perfect', emoji: '💯', name: 'מושלם', description: 'תרגול של 10 שאלות ומעלה בלי אף טעות', test: (c) => c.session.total >= 10 && c.session.correct === c.session.total },
  { id: 'speedy', emoji: '⚡', name: 'מהיר כברק', description: '10 שאלות ומעלה, 80% הצלחה וממוצע מתחת ל-20 שניות', test: (c) => c.session.total >= 10 && c.session.correct / c.session.total >= 0.8 && c.session.avgTimeMs < 20_000 },
  { id: 'hundred', emoji: '🎯', name: 'מאה', description: 'ענית על 100 שאלות', test: (c) => c.totalAnswered >= 100 },
  { id: 'five-hundred', emoji: '🏔️', name: 'חמש מאות', description: 'ענית על 500 שאלות', test: (c) => c.totalAnswered >= 500 },
  { id: 'all-topics', emoji: '🧩', name: 'רב-תחומי', description: 'תרגלת את כל ארבעת הנושאים', test: (c) => c.topicsPracticed.size >= 4 },
  { id: 'hard-20', emoji: '🦾', name: 'לא מפחד מקשות', description: '20 תשובות נכונות בשאלות קשות', test: (c) => c.hardCorrect >= 20 },
  { id: 'days-3', emoji: '📅', name: '3 ימים ברצף', description: 'תרגלת 3 ימים רצופים', test: (c) => c.streakDays >= 3 },
  { id: 'days-7', emoji: '🗓️', name: 'שבוע ברצף', description: 'תרגלת 7 ימים רצופים', test: (c) => c.streakDays >= 7 },
  { id: 'fixer', emoji: '🔧', name: 'מתקן טעויות', description: 'הוצאת 10 שאלות ממאגר הטעויות', test: (c) => c.mistakesCleared >= 10 },
  { id: 'sim-first', emoji: '📝', name: 'מבחן ראשון', description: 'השלמת סימולציה מלאה', test: (c) => c.simulations >= 1 },
  { id: 'sim-70', emoji: '🏅', name: '70 ומעלה', description: 'ציון מוערך 70 ומעלה בסימולציה', test: (c) => c.bestSimulation >= 70 },
  { id: 'sim-90', emoji: '🏆', name: 'תשעים!', description: 'ציון מוערך 90 בסימולציה', test: (c) => c.bestSimulation >= 90 },
];

export interface Reward {
  xp: number;
  breakdown: { label: string; xp: number }[];
  levelBefore: number;
  levelAfter: number;
  newBadges: Badge[];
  streak: number;
}

export function longestRun(results: boolean[]): number {
  let best = 0;
  let cur = 0;
  for (const r of results) {
    cur = r ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}
