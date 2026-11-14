import { isMathText } from '../lib/format';
import instructionsRaw from './data/instructions.json';
import matricesRaw from './data/matrices.json';
import quantitativeRaw from './data/quantitative.json';
import verbalRaw from './data/verbal.json';
import { generatorsFor, regenerate } from './generators';
import { buildMatrixQuestion } from './matrices/generator';
import {
  CHOICE_IDS,
  type Content,
  type Passage,
  type Question,
  type RawMatrixQuestion,
  type RawQuestion,
  type RawText,
  type Topic,
} from './types';

function toContent(raw: RawText): Content {
  if (typeof raw === 'string') return isMathText(raw) ? { kind: 'text', text: raw, ltr: true } : { kind: 'text', text: raw };
  return { kind: 'text', text: raw.text, ltr: raw.ltr ?? isMathText(raw.text) };
}

/** ממיר את פורמט הכתיבה המקוצר של ה-JSON למודל המלא */
export function normalize(topic: Topic, raw: RawQuestion, passages: Record<string, Passage> = {}): Question {
  const prompts = Array.isArray(raw.prompt) ? raw.prompt : [raw.prompt];
  const passage = raw.passageId ? passages[raw.passageId] : undefined;
  if (raw.passageId && !passage) throw new Error(`unknown passage ${raw.passageId} in ${raw.id}`);
  return {
    id: raw.id,
    topic,
    subtopic: raw.subtopic,
    difficulty: raw.difficulty,
    passage,
    prompt: prompts.map(toContent),
    choices: raw.choices.map((c, i) => {
      const content = toContent(typeof c === 'string' ? c : { text: c.text, ltr: c.ltr });
      return typeof c !== 'string' && c.value !== undefined
        ? { id: CHOICE_IDS[i], content, value: c.value }
        : { id: CHOICE_IDS[i], content };
    }),
    correctChoiceId: raw.correct,
    explanation: raw.explanation,
    verify: raw.verify,
    needsReview: raw.needsReview,
    reviewNote: raw.reviewNote,
  };
}

const instr = instructionsRaw as unknown as { passages: Passage[]; questions: RawQuestion[] };
const PASSAGES: Record<string, Passage> = Object.fromEntries(instr.passages.map((p) => [p.id, p]));

function loadMatrices(list: RawMatrixQuestion[]): Question[] {
  return list.map((m) => ({
    ...buildMatrixQuestion(m.id, m.spec, m.subtopic, m.difficulty, m.seed),
    needsReview: m.needsReview,
    reviewNote: m.reviewNote,
  }));
}

/** כל השאלות במאגר, כולל אלה שמסומנות לבדיקה */
export const ALL_BANK: Record<Topic, Question[]> = {
  quantitative: (quantitativeRaw as unknown as RawQuestion[]).map((r) => normalize('quantitative', r)),
  verbal: (verbalRaw as unknown as RawQuestion[]).map((r) => normalize('verbal', r)),
  instructions: instr.questions.map((r) => normalize('instructions', r, PASSAGES)),
  matrices: loadMatrices(matricesRaw as unknown as RawMatrixQuestion[]),
};

/** שאלות שמותר להציג בתרגול (בלי needsReview) */
export function bankFor(topic: Topic): Question[] {
  return ALL_BANK[topic].filter((q) => !q.needsReview);
}

export function isTopicAvailable(topic: Topic): boolean {
  return bankFor(topic).length > 0 || generatorsFor(topic).length > 0;
}

const BY_ID = new Map(Object.values(ALL_BANK).flat().map((q) => [q.id, q]));

export function getQuestionById(id: string): Question | undefined {
  return BY_ID.get(id) ?? regenerate(id);
}
