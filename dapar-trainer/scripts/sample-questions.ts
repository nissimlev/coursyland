/**
 * מדפיס דוגמאות של שאלות מחוללות, לבדיקה ידנית של הניסוח וההסברים.
 * הרצה:  npx vite-node scripts/sample-questions.ts
 */
import { generateQuestion, GENERATORS } from '../src/questions/generators';
import { DIFFICULTIES } from '../src/questions/types';
import { contentText } from '../src/questions/validate';

for (const gen of GENERATORS) {
  for (const d of DIFFICULTIES) {
    for (const seed of [11, 22]) {
      const q = generateQuestion(gen, d, seed);
      const correct = q.choices.find((c) => c.id === q.correctChoiceId)!;
      console.log(`--- ${q.id} [${q.subtopic}]`);
      console.log('Q:', q.prompt.map(contentText).join(' | '));
      console.log('A:', q.choices.map((c) => contentText(c.content)).join(' / '), ' => ', contentText(correct.content));
      console.log('E:', q.explanation);
    }
  }
}
