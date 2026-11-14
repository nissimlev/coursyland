import { formatNumber, isMathText, round2 } from '../../lib/format';
import type { Rng } from '../../engine/rng';
import { CHOICE_IDS, type Choice, type ChoiceId, type Content, type Difficulty, type Subtopic, type Topic, type VerifySpec } from '../types';

export interface GeneratedDraft {
  subtopic: Subtopic;
  prompt: Content[];
  choices: Choice[];
  correctChoiceId: ChoiceId;
  explanation: string;
  verify?: VerifySpec;
}

export type Template = (rng: Rng) => GeneratedDraft;

export interface QuestionGenerator {
  id: string;
  topic: Topic;
  /** תת-נושא ברירת מחדל (תבנית יכולה לדרוס) */
  subtopic: Subtopic;
  build(rng: Rng, difficulty: Difficulty): GeneratedDraft;
}

export function text(t: string, ltr = false): Content {
  return ltr ? { kind: 'text', text: t, ltr: true } : { kind: 'text', text: t };
}

interface NumericChoiceOptions {
  /** פורמט הטקסט של התשובה, למשל הוספת יחידות */
  format?: (n: number) => string;
  /** רק מסיחים שלמים */
  integer?: boolean;
  /** ערך מינימלי למסיח */
  min?: number;
}

/**
 * בונה 4 תשובות מספריות: התשובה הנכונה + 3 מסיחים.
 * candidates הם מסיחים "חכמים" (טעויות נפוצות); אם חסרים, משלימים בערכים קרובים.
 * התשובה הנכונה תמיד ב-a: הסדר מתערבב בזמן ההצגה.
 */
export function numericChoices(
  rng: Rng,
  answer: number,
  candidates: number[],
  opts: NumericChoiceOptions = {},
): { choices: Choice[]; correctChoiceId: ChoiceId } {
  const fmt = opts.format ?? formatNumber;
  const seen = new Set<string>([fmt(answer)]);
  const wrong: number[] = [];

  const ok = (c: number) =>
    Number.isFinite(c) &&
    Math.abs(c - answer) > 1e-9 &&
    (opts.min === undefined || c >= opts.min) &&
    (!opts.integer || Number.isInteger(c));

  const tryAdd = (raw: number) => {
    const c = round2(raw);
    if (wrong.length >= 3 || !ok(c)) return;
    const key = fmt(c);
    if (seen.has(key)) return;
    seen.add(key);
    wrong.push(c);
  };

  for (const c of rng.shuffle(candidates)) tryAdd(c);

  const spread = Math.max(2, Math.round(Math.abs(answer) * 0.15));
  for (let i = 0; wrong.length < 3 && i < 200; i++) {
    const delta = rng.int(1, spread) * (rng.chance(0.5) ? 1 : -1);
    tryAdd(Number.isInteger(answer) ? answer + delta : answer + delta / 2);
  }
  for (let k = 1; wrong.length < 3; k++) tryAdd(answer + k); // גיבוי דטרמיניסטי

  const values = [answer, ...wrong];
  return {
    choices: values.map((v, i) => ({ id: CHOICE_IDS[i], content: text(fmt(v), isMathText(fmt(v))), value: v })),
    correctChoiceId: 'a',
  };
}

export const shekel = (n: number) => `${formatNumber(n)} ש״ח`;
export const fmt = formatNumber;

export function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export const MALE_NAMES = ['איתי', 'יונתן', 'עומר', 'אורי', 'דניאל', 'נועם', 'אריאל', 'עידו', 'רועי', 'אלון'];
export const FEMALE_NAMES = ['נועה', 'מאיה', 'תמר', 'שירה', 'רוני', 'יעל', 'הילה', 'עדי', 'ליאור', 'אביגיל'];
