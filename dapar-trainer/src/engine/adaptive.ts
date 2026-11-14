import type { Difficulty } from '../questions/types';

/** כמה תשובות נכונות ברצף מעלות רמה, וכמה טעויות ברצף מורידות */
export const ADAPTIVE_UP_AFTER = 3;
export const ADAPTIVE_DOWN_AFTER = 2;

export interface AdaptiveState {
  level: Difficulty;
  rightStreak: number;
  wrongStreak: number;
}

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

export const initialAdaptive = (): AdaptiveState => ({ level: 'medium', rightStreak: 0, wrongStreak: 0 });

export function adaptiveStep(s: AdaptiveState, correct: boolean): AdaptiveState {
  const i = LEVELS.indexOf(s.level);
  if (correct) {
    const rightStreak = s.rightStreak + 1;
    if (rightStreak >= ADAPTIVE_UP_AFTER && i < LEVELS.length - 1) {
      return { level: LEVELS[i + 1], rightStreak: 0, wrongStreak: 0 };
    }
    return { ...s, rightStreak, wrongStreak: 0 };
  }
  const wrongStreak = s.wrongStreak + 1;
  if (wrongStreak >= ADAPTIVE_DOWN_AFTER && i > 0) {
    return { level: LEVELS[i - 1], rightStreak: 0, wrongStreak: 0 };
  }
  return { ...s, wrongStreak, rightStreak: 0 };
}
