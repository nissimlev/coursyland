import { bankFor, getQuestionById, isTopicAvailable } from '../questions/bank';
import { generateQuestion, generatorsFor } from '../questions/generators';
import { CHOICE_IDS, DIFFICULTIES, type ChoiceId, type Difficulty, type DifficultySetting, type Question, type Topic } from '../questions/types';
import { liveRng, randomSeed, type Rng } from './rng';

export type PracticeMode = 'topic' | 'mixed' | 'mistakes';
export type ItemResult = 'correct' | 'wrong' | 'timeout';

export interface SessionSettings {
  mode: PracticeMode;
  topics: Topic[];
  difficulty: DifficultySetting;
  count: number;
  /** null = בלי טיימר */
  timePerQuestionSec: number | null;
  /** למאגר הטעויות: אילו שאלות לתרגל */
  questionIds?: string[];
}

export interface SessionItem {
  question: Question;
  /** סדר ההצגה של התשובות (מעורבב) */
  order: ChoiceId[];
  chosen: ChoiceId | null;
  result: ItemResult | null;
  timeMs: number;
}

export function makeItem(question: Question, rng: Rng): SessionItem {
  return { question, order: rng.shuffle(CHOICE_IDS), chosen: null, result: null, timeMs: 0 };
}

/** בוחר את השאלה הבאה: מהמאגר הקבוע או מהמחוללים, בלי חזרות בתוך אותו סשן */
export class QuestionPicker {
  private used = new Set<string>();
  private rng: Rng = liveRng();
  private queue: string[] = [];
  private topics: Topic[];
  private topicCursor = 0;

  constructor(private settings: SessionSettings) {
    this.topics = settings.topics.filter(isTopicAvailable);
    if (settings.mode === 'mistakes') this.queue = this.rng.shuffle(settings.questionIds ?? []);
    else this.topics = this.rng.shuffle(this.topics);
  }

  get rngRef(): Rng {
    return this.rng;
  }

  /** כמה שאלות הסשן יכול לספק בפועל */
  get capacity(): number {
    return this.settings.mode === 'mistakes' ? Math.min(this.queue.length, this.settings.count) : this.settings.count;
  }

  next(difficulty: Difficulty): Question | null {
    if (this.settings.mode === 'mistakes') {
      while (this.queue.length) {
        const q = getQuestionById(this.queue.shift()!);
        if (q && !q.needsReview) return q;
      }
      return null;
    }
    if (this.topics.length === 0) return null;
    const topic = this.topics[this.topicCursor++ % this.topics.length];
    const q = this.pickFromTopic(topic, difficulty);
    this.used.add(q.id);
    return q;
  }

  private pickFromTopic(topic: Topic, difficulty: Difficulty): Question {
    const bank = bankFor(topic);
    const gens = generatorsFor(topic);
    const pool = bank.filter((q) => q.difficulty === difficulty && !this.used.has(q.id));

    if (pool.length && (gens.length === 0 || this.rng.chance(0.5))) return this.rng.pick(pool);
    if (gens.length) return generateQuestion(this.rng.pick(gens), difficulty, randomSeed());

    // אין מחולל ונגמרו השאלות ברמה הזו: לוקחים מרמה אחרת, ואם הכול נוצל מתחילים מחדש
    const anyUnused = bank.filter((q) => !this.used.has(q.id));
    if (anyUnused.length) return this.rng.pick(anyUnused);
    this.used.clear();
    return this.rng.pick(bank);
  }
}

export function pickDifficulty(setting: DifficultySetting, adaptiveLevel: Difficulty, rng: Rng): Difficulty {
  if (setting === 'adaptive') return adaptiveLevel;
  if (setting === 'mixed') return rng.pick(DIFFICULTIES);
  return setting;
}
