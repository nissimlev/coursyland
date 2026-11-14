import { describe, expect, it } from 'vitest';
import { adaptiveStep, initialAdaptive } from '../src/engine/adaptive';
import { dayKey, levelFromXp, longestRun, updateStreak, xpForLevel } from '../src/engine/gamification';
import { estimateDapar, sectionScore, weightedPct } from '../src/engine/scoring';
import { ALL_BANK, bankFor } from '../src/questions/bank';

describe('adaptive difficulty', () => {
  it('goes up after 3 correct and down after 2 wrong', () => {
    let s = initialAdaptive();
    s = adaptiveStep(adaptiveStep(adaptiveStep(s, true), true), true);
    expect(s.level).toBe('hard');
    s = adaptiveStep(adaptiveStep(s, false), false);
    expect(s.level).toBe('medium');
    s = adaptiveStep(adaptiveStep(s, false), false);
    expect(s.level).toBe('easy');
    s = adaptiveStep(adaptiveStep(s, false), false);
    expect(s.level).toBe('easy');
  });
});

describe('scoring', () => {
  it('maps percentages to 1–9 and 10–90', () => {
    expect(sectionScore(0)).toBe(1);
    expect(sectionScore(1)).toBe(9);
    expect(sectionScore(0.5)).toBe(5);
    expect(estimateDapar([{ topic: 'verbal', pct: 1 }, { topic: 'matrices', pct: 1 }])).toBe(90);
    expect(estimateDapar([{ topic: 'verbal', pct: 0 }])).toBe(10);
  });
  it('weights hard questions more', () => {
    const hardRight = weightedPct([{ difficulty: 'hard', correct: true }, { difficulty: 'easy', correct: false }]);
    const easyRight = weightedPct([{ difficulty: 'hard', correct: false }, { difficulty: 'easy', correct: true }]);
    expect(hardRight).toBeGreaterThan(easyRight);
  });
});

describe('gamification', () => {
  it('levels grow with XP', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(xpForLevel(2))).toBe(2);
    expect(levelFromXp(xpForLevel(5) - 1)).toBe(4);
  });
  it('day streak continues on consecutive days and resets after a gap', () => {
    const day = 86_400_000;
    const t0 = new Date(2026, 10, 10, 12).getTime();
    let s = updateStreak({ current: 0, best: 0, lastDay: null }, t0);
    s = updateStreak(s, t0 + 1000); // אותו יום
    expect(s.current).toBe(1);
    s = updateStreak(s, t0 + day);
    expect(s.current).toBe(2);
    s = updateStreak(s, t0 + 3 * day);
    expect(s).toEqual({ current: 1, best: 2, lastDay: dayKey(t0 + 3 * day) });
  });
  it('longest run', () => {
    expect(longestRun([true, true, false, true, true, true])).toBe(3);
  });
});

describe('needsReview', () => {
  it('questions marked for review are excluded from practice', () => {
    for (const t of ['verbal', 'instructions', 'quantitative', 'matrices'] as const) {
      const flagged = ALL_BANK[t].filter((q) => q.needsReview);
      for (const q of flagged) expect(bankFor(t)).not.toContain(q);
      for (const q of flagged) expect(q.reviewNote, q.id).toBeTruthy();
    }
  });
});
