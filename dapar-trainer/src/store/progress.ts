import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  BADGES,
  levelFromXp,
  liveStreak,
  longestRun,
  updateStreak,
  XP_PER_CORRECT,
  XP_PERFECT_BONUS,
  XP_SESSION_BONUS,
  XP_SIMULATION_BONUS,
  type Reward,
  type Streak,
} from '../engine/gamification';
import type { ItemResult, PracticeMode } from '../engine/session';
import type { Difficulty, DifficultySetting, Subtopic, Topic } from '../questions/types';

export interface Attempt {
  qid: string;
  topic: Topic;
  subtopic: Subtopic;
  difficulty: Difficulty;
  result: ItemResult;
  timeMs: number;
  at: number;
  sessionId: string;
}

export interface SessionRecord {
  id: string;
  mode: PracticeMode | 'simulation';
  topics: Topic[];
  difficulty: DifficultySetting;
  total: number;
  correct: number;
  wrong: number;
  timeout: number;
  avgTimeMs: number;
  startedAt: number;
  endedAt: number;
}

export interface SimulationRecord {
  id: string;
  at: number;
  durationSec: number;
  estimated: number;
  /** כמה שאלות נענו בפועל */
  answered: number;
  sections: { topic: Topic; correct: number; total: number; score: number; timeUsedSec: number }[];
}

export interface MistakeEntry {
  qid: string;
  topic: Topic;
  timesWrong: number;
  lastWrongAt: number;
  /** תשובות נכונות ברצף מאז הטעות האחרונה */
  rightStreak: number;
}

/** אחרי כמה תשובות נכונות ברצף שאלה יוצאת ממאגר הטעויות */
export const MISTAKE_CLEAR_AFTER = 2;
const MAX_ATTEMPTS = 5000;
const MAX_SESSIONS = 500;

interface ProgressState {
  attempts: Attempt[];
  sessions: SessionRecord[];
  simulations: SimulationRecord[];
  mistakes: Record<string, MistakeEntry>;
  xp: number;
  streak: Streak;
  badges: Record<string, number>;
  mistakesCleared: number;
  /** מצטבר, כדי שלא יאבד כשרשימת הניסיונות נחתכת */
  totals: { answered: number; hardCorrect: number; topics: Topic[] };
  commitSession: (record: SessionRecord, attempts: Attempt[], simulation?: SimulationRecord) => Reward;
  resetAll: () => void;
}

const EMPTY = {
  attempts: [] as Attempt[],
  sessions: [] as SessionRecord[],
  simulations: [] as SimulationRecord[],
  mistakes: {} as Record<string, MistakeEntry>,
  xp: 0,
  streak: { current: 0, best: 0, lastDay: null } as Streak,
  badges: {} as Record<string, number>,
  mistakesCleared: 0,
  totals: { answered: 0, hardCorrect: 0, topics: [] as Topic[] },
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      commitSession: (record, newAttempts, simulation) => {
        const s = get();
        const now = record.endedAt;

        // מאגר טעויות
        const mistakes = { ...s.mistakes };
        let cleared = 0;
        for (const a of newAttempts) {
          const prev = mistakes[a.qid];
          if (a.result === 'correct') {
            if (prev) {
              const rightStreak = prev.rightStreak + 1;
              if (rightStreak >= MISTAKE_CLEAR_AFTER) {
                delete mistakes[a.qid];
                cleared++;
              } else mistakes[a.qid] = { ...prev, rightStreak };
            }
          } else {
            mistakes[a.qid] = { qid: a.qid, topic: a.topic, timesWrong: (prev?.timesWrong ?? 0) + 1, lastWrongAt: a.at, rightStreak: 0 };
          }
        }

        // XP
        const breakdown: Reward['breakdown'] = [];
        const correctXp = newAttempts.filter((a) => a.result === 'correct').reduce((sum, a) => sum + XP_PER_CORRECT[a.difficulty], 0);
        if (correctXp) breakdown.push({ label: 'תשובות נכונות', xp: correctXp });
        // בונוס רק על עבודה אמיתית: בסימולציה צריך לענות על חצי מהשאלות לפחות
        const answeredCount = newAttempts.filter((a) => a.result !== 'timeout').length;
        if (simulation) {
          if (answeredCount >= record.total / 2) breakdown.push({ label: 'השלמת סימולציה', xp: XP_SIMULATION_BONUS });
        } else if (record.total >= 5) breakdown.push({ label: 'סיום תרגול', xp: XP_SESSION_BONUS });
        if (record.total >= 10 && record.correct === record.total) breakdown.push({ label: 'תרגול מושלם', xp: XP_PERFECT_BONUS });
        const gained = breakdown.reduce((sum, b) => sum + b.xp, 0);

        const streak = updateStreak(s.streak, now);
        const totals = {
          answered: s.totals.answered + newAttempts.length,
          hardCorrect: s.totals.hardCorrect + newAttempts.filter((a) => a.difficulty === 'hard' && a.result === 'correct').length,
          topics: [...new Set([...s.totals.topics, ...newAttempts.filter((a) => a.result !== 'timeout').map((a) => a.topic)])],
        };
        const simulations = simulation ? [...s.simulations, simulation] : s.simulations;
        // מבחן נספר לתגים רק אם ענו על חצי מהשאלות לפחות
        const realSims = simulations.filter((x) => (x.answered ?? 0) >= x.sections.reduce((a, b) => a + b.total, 0) / 2);
        const mistakesCleared = s.mistakesCleared + cleared;

        // תגים
        const ctx = {
          totalAnswered: totals.answered,
          hardCorrect: totals.hardCorrect,
          topicsPracticed: new Set(totals.topics),
          streakDays: liveStreak(streak, now),
          mistakesCleared,
          simulations: realSims.length,
          bestSimulation: Math.max(0, ...realSims.map((x) => x.estimated)),
          session: {
            total: record.total,
            correct: record.correct,
            avgTimeMs: record.avgTimeMs,
            bestRun: simulation ? 0 : longestRun(newAttempts.map((a) => a.result === 'correct')),
            isSimulation: !!simulation,
          },
        };
        const newBadges = BADGES.filter((b) => !s.badges[b.id] && b.test(ctx));
        const badges = { ...s.badges };
        for (const b of newBadges) badges[b.id] = now;

        const xp = s.xp + gained;
        set({
          attempts: [...s.attempts, ...newAttempts].slice(-MAX_ATTEMPTS),
          sessions: [...s.sessions, record].slice(-MAX_SESSIONS),
          simulations,
          mistakes,
          xp,
          streak,
          badges,
          mistakesCleared,
          totals,
        });
        return { xp: gained, breakdown, levelBefore: levelFromXp(s.xp), levelAfter: levelFromXp(xp), newBadges, streak: streak.current };
      },
      resetAll: () => set({ ...EMPTY }),
    }),
    {
      name: 'dapar:progress',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // גרסה 1 לא כללה XP ותגים: משלימים ערכי ברירת מחדל
      migrate: (persisted) => ({ ...EMPTY, ...(persisted as object) }),
    },
  ),
);
