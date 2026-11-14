import { SIMULATION_CONFIG } from '../config/simulation.config';
import type { Difficulty, Topic } from '../questions/types';

export interface ScoredItem {
  difficulty: Difficulty;
  correct: boolean;
}

/** אחוז הצלחה משוקלל לפי קושי (0–1) */
export function weightedPct(items: ScoredItem[]): number {
  const w = SIMULATION_CONFIG.difficultyWeight;
  const total = items.reduce((s, i) => s + w[i.difficulty], 0);
  if (total === 0) return 0;
  return items.reduce((s, i) => s + (i.correct ? w[i.difficulty] : 0), 0) / total;
}

/** ציון פרק בסולם 1–9 (הערכה) */
export function sectionScore(pct: number): number {
  return Math.min(9, Math.max(1, 1 + Math.round(pct * 8)));
}

/** ציון דפ״ר מוערך בסולם 10–90, בקפיצות של 10 (הערכה בלבד, לא הנוסחה הרשמית) */
export function estimateDapar(sectionPcts: { topic: Topic; pct: number }[]): number {
  const w = SIMULATION_CONFIG.weights;
  const totalW = sectionPcts.reduce((s, x) => s + w[x.topic], 0);
  const pct = totalW ? sectionPcts.reduce((s, x) => s + x.pct * w[x.topic], 0) / totalW : 0;
  return 10 * sectionScore(pct);
}
