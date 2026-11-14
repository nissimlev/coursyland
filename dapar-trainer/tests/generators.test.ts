import { describe, expect, it } from 'vitest';
import { getQuestionById } from '../src/questions/bank';
import { generateQuestion, generatorsFor } from '../src/questions/generators';
import { DIFFICULTIES } from '../src/questions/types';
import { validateQuestion } from '../src/questions/validate';

describe('quantitative generators', () => {
  const SAMPLES = 400;
  for (const gen of generatorsFor('quantitative')) {
    for (const d of DIFFICULTIES) {
      it(`${gen.id} / ${d}: ${SAMPLES} generated questions are valid`, () => {
        const errors: string[] = [];
        const prompts = new Set<string>();
        for (let seed = 1; seed <= SAMPLES; seed++) {
          const q = generateQuestion(gen, d, seed);
          errors.push(...validateQuestion(q));
          prompts.add(q.prompt.map((p) => (p.kind === 'text' ? p.text : '')).join('|'));
        }
        expect(errors.slice(0, 10)).toEqual([]);
        // המחולל באמת מגוון
        expect(prompts.size).toBeGreaterThan(SAMPLES * 0.3);
      });
    }
  }

  it('regenerates the exact same question from its id', () => {
    for (const gen of generatorsFor('quantitative')) {
      const q = generateQuestion(gen, 'medium', 12345);
      expect(getQuestionById(q.id)).toEqual(q);
    }
  });
});
