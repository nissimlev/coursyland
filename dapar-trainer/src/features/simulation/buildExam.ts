import { SIMULATION_CONFIG, type SectionConfig } from '../../config/simulation.config';
import { liveRng } from '../../engine/rng';
import { makeItem, QuestionPicker, type SessionItem } from '../../engine/session';
import { DIFFICULTIES, type Difficulty } from '../../questions/types';

export interface ExamSection {
  config: SectionConfig;
  items: SessionItem[];
  flagged: boolean[];
  timeUsedSec: number;
}

/** רשימת רמות קושי לפי חלוקת ה-config, מעורבבת */
function difficultyPlan(n: number): Difficulty[] {
  const mix = SIMULATION_CONFIG.difficultyMix;
  const counts = DIFFICULTIES.map((d) => Math.round(n * mix[d]));
  // תיקון עיגול: הפרש מתווסף לבינוני
  counts[1] += n - counts.reduce((a, b) => a + b, 0);
  const list = DIFFICULTIES.flatMap((d, i) => Array<Difficulty>(Math.max(0, counts[i])).fill(d));
  return liveRng().shuffle(list);
}

export function buildExam(): ExamSection[] {
  return SIMULATION_CONFIG.sections.map((config) => {
    const picker = new QuestionPicker({ mode: 'topic', topics: [config.topic], difficulty: 'mixed', count: config.questions, timePerQuestionSec: null });
    const items = difficultyPlan(config.questions)
      .map((d) => picker.next(d))
      .filter((q) => q !== null)
      .map((q) => makeItem(q!, picker.rngRef));
    return { config, items, flagged: items.map(() => false), timeUsedSec: 0 };
  });
}
