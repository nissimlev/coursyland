/**
 * מייצר את מאגר המטריצות הקבוע (src/questions/data/matrices.json).
 * כל מטריצה נשמרת כמפרט חוקיות + seed למסיחים. הפותר בבדיקות מוודא שכל אחת חד-משמעית.
 * הרצה:  npx vite-node scripts/gen-matrices.ts
 */
import { writeFileSync } from 'node:fs';
import { createRng } from '../src/engine/rng';
import { generateMatrixSpec } from '../src/questions/matrices/generator';
import type { Difficulty, MatricesSubtopic, RawMatrixQuestion } from '../src/questions/types';

const PLAN: { difficulty: Difficulty; subtopics: (MatricesSubtopic | undefined)[] }[] = [
  { difficulty: 'easy', subtopics: ['rotation', 'add-element', 'count', 'fill-color', 'rotation', 'add-element', 'count', 'fill-color', 'rotation', 'add-element', 'count', 'fill-color', 'fill-color', 'rotation'] },
  { difficulty: 'medium', subtopics: Array(14).fill(undefined) },
  { difficulty: 'hard', subtopics: Array(14).fill(undefined) },
];

const out: RawMatrixQuestion[] = [];
let n = 0;
for (const { difficulty, subtopics } of PLAN) {
  subtopics.forEach((sub, i) => {
    const seed = 1000 + n * 37;
    const rng = createRng(seed);
    const { spec, subtopic } = generateMatrixSpec(rng, difficulty, sub);
    n++;
    out.push({ id: `matrix-${difficulty}-${String(i + 1).padStart(2, '0')}`, subtopic, difficulty, spec, seed });
  });
}

writeFileSync(new URL('../src/questions/data/matrices.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${out.length} matrices`);
