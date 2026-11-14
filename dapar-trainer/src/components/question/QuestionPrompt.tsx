import { DIFFICULTY_CHIP, DIFFICULTY_NAMES, SUBTOPIC_NAMES, TOPICS } from '../../questions/topics';
import type { Passage, Question } from '../../questions/types';
import { Chip } from '../ui/Card';
import { ContentView } from './ContentView';

export function QuestionMeta({ question, showTopic = false }: { question: Question; showTopic?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {showTopic && <Chip className={TOPICS[question.topic].chip}>{TOPICS[question.topic].short}</Chip>}
      <Chip className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{SUBTOPIC_NAMES[question.subtopic]}</Chip>
      <Chip className={DIFFICULTY_CHIP[question.difficulty]}>{DIFFICULTY_NAMES[question.difficulty]}</Chip>
    </div>
  );
}

export function PassageBox({ passage }: { passage: Passage }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 dark:border-amber-500/25 dark:bg-amber-500/5">
      <h3 className="mb-2 font-extrabold text-amber-800 dark:text-amber-300">📋 {passage.title}</h3>
      <div className="space-y-1.5 leading-relaxed text-slate-800 dark:text-slate-200">
        {passage.text.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </section>
  );
}

export function QuestionPrompt({ question }: { question: Question }) {
  return (
    <div className="space-y-4">
      {question.passage && <PassageBox passage={question.passage} />}
      <div className="space-y-2">
        {question.prompt.map((p, i) => {
          if (p.kind === 'figure') return <ContentView key={i} content={p} />;
          if (p.ltr)
            return (
              <p key={i} className="py-1 text-center text-2xl font-bold tracking-wide sm:text-3xl">
                <ContentView content={p} />
              </p>
            );
          // שורת נתונים של מועמד ("שם: ...") מוצגת כפריט ברשימה
          const isItem = i > 0 && /^[^\s:]{1,12}( [^\s:]{1,8})?:/.test(p.text);
          return (
            <p
              key={i}
              className={
                isItem
                  ? 'rounded-lg bg-slate-50 px-3 py-1.5 text-base leading-relaxed dark:bg-slate-800/60'
                  : 'text-lg leading-relaxed font-medium sm:text-xl'
              }
            >
              <ContentView content={p} />
            </p>
          );
        })}
      </div>
    </div>
  );
}
