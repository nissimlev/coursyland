import { describe, expect, it } from 'vitest';
import { ALL_BANK, getQuestionById } from '../src/questions/bank';
import { generateQuestion, generatorsFor } from '../src/questions/generators';
import { cellAt, cellKey } from '../src/questions/matrices/model';
import { solveMatrix } from '../src/questions/matrices/solver';
import { DIFFICULTIES, type Topic } from '../src/questions/types';
import { validateQuestion } from '../src/questions/validate';

const TOPICS: Topic[] = ['verbal', 'instructions', 'quantitative', 'matrices'];

describe.each(TOPICS)('%s bank', (topic) => {
  const bank = ALL_BANK[topic];

  it('has at least 40 questions spread over all difficulties', () => {
    expect(bank.length).toBeGreaterThanOrEqual(40);
    for (const d of DIFFICULTIES) expect(bank.filter((q) => q.difficulty === d).length, d).toBeGreaterThanOrEqual(8);
  });

  it('has unique ids', () => {
    expect(new Set(bank.map((q) => q.id)).size).toBe(bank.length);
  });

  it('every question is structurally valid and verified where possible', () => {
    expect(bank.flatMap(validateQuestion)).toEqual([]);
  });

  it('the correct answer is spread across a–d (not always the same letter)', () => {
    if (topic === 'matrices') return; // במטריצות הסדר נקבע בזמן ההצגה
    const letters = new Set(bank.map((q) => q.correctChoiceId));
    expect(letters.size).toBeGreaterThanOrEqual(3);
  });
});

describe('automatic verification coverage', () => {
  it('quantitative, instructions and matrices are 100% machine-verified', () => {
    for (const t of ['quantitative', 'instructions', 'matrices'] as Topic[]) {
      expect(ALL_BANK[t].filter((q) => !q.verify).map((q) => q.id), t).toEqual([]);
    }
  });
});

describe('matrix generator', () => {
  const gen = generatorsFor('matrices')[0];
  for (const d of DIFFICULTIES) {
    it(`${d}: 300 generated matrices are unambiguous with exactly one matching choice`, () => {
      const errors: string[] = [];
      for (let seed = 1; seed <= 300; seed++) errors.push(...validateQuestion(generateQuestion(gen, d, seed)));
      expect(errors.slice(0, 10)).toEqual([]);
    });
  }

  it('regenerates the same matrix from its id', () => {
    const q = generateQuestion(gen, 'hard', 777);
    expect(getQuestionById(q.id)).toEqual(q);
  });

  it('solver detects an ambiguous matrix', () => {
    // כל המשבצות זהות חוץ מספירה שמופיעה פעם אחת: אין חוקיות חד-משמעית
    const base = { shape: 'circle', count: 1, fill: 'none', color: 'sky', rotation: 0, dots: 0 } as const;
    const cells = [1, 2, 1, 2, 1, 2, 1, 2].map((count) => ({ ...base, count }));
    const sol = solveMatrix([...cells, null]);
    expect(sol.cell).toBeNull();
  });

  it('solver finds a row-sum rule', () => {
    const spec = {
      shape: { type: 'const', value: 'star' },
      count: { type: 'const', value: 1 },
      fill: { type: 'const', value: 'solid' },
      color: { type: 'const', value: 'rose' },
      rotation: { type: 'const', value: 0 },
      dots: { type: 'sum', firsts: [[1, 2], [2, 2], [0, 1]] },
    } as const;
    const grid = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => cellAt(spec as never, r, c)));
    const sol = solveMatrix([...grid.slice(0, 8), null]);
    expect(sol.cell && cellKey(sol.cell)).toBe(cellKey(grid[8]));
  });
});
