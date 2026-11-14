import { TOPIC_ORDER } from '../questions/topics';
import type { Difficulty, DifficultySetting, Topic } from '../questions/types';
import type { Attempt } from '../store/progress';
import { dayKey } from './gamification';

export interface Bucket {
  total: number;
  correct: number;
  pct: number | null;
  avgTimeMs: number | null;
}

export function bucket(list: Attempt[]): Bucket {
  const correct = list.filter((a) => a.result === 'correct').length;
  return {
    total: list.length,
    correct,
    pct: list.length ? Math.round((correct / list.length) * 100) : null,
    avgTimeMs: list.length ? list.reduce((s, a) => s + a.timeMs, 0) / list.length : null,
  };
}

export function byTopic(attempts: Attempt[]): Record<Topic, Bucket> {
  return Object.fromEntries(TOPIC_ORDER.map((t) => [t, bucket(attempts.filter((a) => a.topic === t))])) as Record<Topic, Bucket>;
}

export function byDifficulty(attempts: Attempt[]): Record<Difficulty, Bucket> {
  return {
    easy: bucket(attempts.filter((a) => a.difficulty === 'easy')),
    medium: bucket(attempts.filter((a) => a.difficulty === 'medium')),
    hard: bucket(attempts.filter((a) => a.difficulty === 'hard')),
  };
}

/** אחוז הצלחה לכל יום שבו היה תרגול (עד maxDays ימים אחרונים) */
export function dailySeries(attempts: Attempt[], maxDays = 14): { day: string; pct: number; total: number }[] {
  const map = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const k = dayKey(a.at);
    map.set(k, [...(map.get(k) ?? []), a]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxDays)
    .map(([day, list]) => ({ day, pct: bucket(list).pct ?? 0, total: list.length }));
}

export interface Recommendation {
  topic: Topic;
  difficulty: DifficultySetting;
  reason: string;
}

const MIN_ATTEMPTS = 5;

export function recommendationTitle(r: Recommendation, topicName: string, difficultyName: string): string {
  return r.difficulty === 'adaptive' ? `${topicName}, במצב אדפטיבי` : `${topicName}, רמה ${difficultyName}`;
}

/** הנושא החלש ביותר + המלצה מה לתרגל עכשיו */
export function recommend(attempts: Attempt[]): Recommendation {
  const recent = attempts.slice(-400);
  const stats = byTopic(recent);
  const untouched = TOPIC_ORDER.filter((t) => stats[t].total < MIN_ATTEMPTS);
  if (untouched.length) {
    const t = untouched[0];
    return { topic: t, difficulty: 'adaptive', reason: 'עוד לא תרגלת מספיק את הנושא הזה. מצב אדפטיבי ימצא את הרמה המתאימה.' };
  }
  const weakest = [...TOPIC_ORDER].sort((a, b) => (stats[a].pct ?? 0) - (stats[b].pct ?? 0))[0];
  const pct = stats[weakest].pct ?? 0;
  const difficulty: DifficultySetting = pct < 50 ? 'easy' : pct < 75 ? 'medium' : 'hard';
  const reason =
    pct < 50
      ? `אחוז ההצלחה כאן ${pct}%, הנמוך מכל הנושאים. כדאי לחזק את הבסיס ברמה קלה ולקרוא היטב את ההסברים.`
      : pct < 75
        ? `זה הנושא החלש ביותר (${pct}%). תרגול ברמה בינונית יעזור לסגור את הפער.`
        : `גם הנושא החלש ביותר כבר ב-${pct}%. הגיע הזמן לאתגר ברמה קשה.`;
  return { topic: weakest, difficulty, reason };
}
