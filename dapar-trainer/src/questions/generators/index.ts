import { createRng } from '../../engine/rng';
import type { Difficulty, Question, Topic } from '../types';
import { arithmeticGenerator } from './arithmetic';
import type { QuestionGenerator } from './common';
import { matrixGenerator } from './matrices';
import { percentGenerator } from './percent';
import { seriesGenerator } from './series';
import { wordProblemGenerator } from './wordProblems';

export const GENERATORS: QuestionGenerator[] = [seriesGenerator, arithmeticGenerator, percentGenerator, wordProblemGenerator, matrixGenerator];

export function generatorsFor(topic: Topic): QuestionGenerator[] {
  return GENERATORS.filter((g) => g.topic === topic);
}

export function generateQuestion(gen: QuestionGenerator, difficulty: Difficulty, seed: number): Question {
  const draft = gen.build(createRng(seed), difficulty);
  return {
    id: `gen:${gen.id}:${difficulty}:${seed}`,
    topic: gen.topic,
    difficulty,
    generated: true,
    ...draft,
  };
}

const GEN_ID = /^gen:([\w-]+):(easy|medium|hard):(\d+)$/;

/** משחזר שאלה מחוללת מתוך המזהה שלה (למאגר הטעויות) */
export function regenerate(id: string): Question | undefined {
  const m = GEN_ID.exec(id);
  if (!m) return undefined;
  const gen = GENERATORS.find((g) => g.id === m[1]);
  if (!gen) return undefined;
  return generateQuestion(gen, m[2] as Difficulty, Number(m[3]));
}
