import { buildMatrixQuestion, generateMatrixSpec } from '../matrices/generator';
import type { QuestionGenerator } from './common';

export const matrixGenerator: QuestionGenerator = {
  id: 'matrix',
  topic: 'matrices',
  subtopic: 'combined',
  build: (rng, difficulty) => {
    const { spec, subtopic } = generateMatrixSpec(rng, difficulty);
    const q = buildMatrixQuestion('tmp', spec, subtopic, difficulty, rng.int(1, 2 ** 30));
    return {
      subtopic: q.subtopic,
      prompt: q.prompt,
      choices: q.choices,
      correctChoiceId: q.correctChoiceId,
      explanation: q.explanation,
      verify: q.verify,
    };
  },
};
