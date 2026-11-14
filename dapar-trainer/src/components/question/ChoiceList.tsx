import type { ChoiceId, Question } from '../../questions/types';
import { CheckIcon, XIcon } from '../ui/Icons';
import { contentLabel, ContentView } from './ContentView';

/**
 * רשימת 4 התשובות. order = סדר ההצגה (מעורבב).
 * reveal=true מציג נכון/לא נכון (במצב תרגול); במצב מבחן reveal=false ורק מסמנים בחירה.
 */
export function ChoiceList({
  question,
  order,
  chosen,
  reveal,
  disabled,
  onChoose,
}: {
  question: Question;
  order: ChoiceId[];
  chosen: ChoiceId | null;
  reveal: boolean;
  disabled: boolean;
  onChoose: (id: ChoiceId) => void;
}) {
  const figures = question.choices.some((c) => c.content.kind === 'figure');
  return (
    <ol className={`grid gap-3 ${figures ? 'grid-cols-2 sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
      {order.map((id, i) => {
        const choice = question.choices.find((c) => c.id === id)!;
        const isCorrect = id === question.correctChoiceId;
        const isChosen = id === chosen;

        let style =
          'border-slate-200 bg-white hover:border-violet-400 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-violet-500 dark:hover:bg-slate-800';
        let badge = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
        let anim = '';
        if (reveal && isCorrect) {
          style = 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-500/10';
          badge = 'bg-emerald-500 text-white';
          if (isChosen) anim = 'animate-pop';
        } else if (reveal && isChosen) {
          style = 'border-rose-400 bg-rose-50 dark:border-rose-500 dark:bg-rose-500/10';
          badge = 'bg-rose-500 text-white';
          anim = 'animate-shake';
        } else if (reveal) {
          style = 'border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-900';
        } else if (isChosen) {
          style = 'border-violet-600 bg-violet-50 ring-2 ring-violet-600/30 dark:border-violet-400 dark:bg-violet-500/10';
          badge = 'bg-violet-600 text-white dark:bg-violet-500';
        }

        return (
          <li key={id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChoose(id)}
              aria-label={`תשובה ${i + 1}: ${contentLabel(choice.content)}`}
              aria-pressed={isChosen}
              className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-start text-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-default ${figures ? 'flex-col justify-center px-2' : ''} ${style} ${anim}`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold ${badge}`}>
                {reveal && isCorrect ? <CheckIcon width={18} height={18} /> : reveal && isChosen ? <XIcon width={18} height={18} /> : i + 1}
              </span>
              <ContentView content={choice.content} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
