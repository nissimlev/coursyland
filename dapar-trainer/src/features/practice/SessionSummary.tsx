import { useState } from 'react';
import { RewardPanel } from '../../components/RewardPanel';
import type { Reward } from '../../engine/gamification';
import { ChoiceList } from '../../components/question/ChoiceList';
import { contentLabel } from '../../components/question/ContentView';
import { QuestionMeta, QuestionPrompt } from '../../components/question/QuestionPrompt';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CheckIcon, ChevronDownIcon, ClockIcon, XIcon } from '../../components/ui/Icons';
import type { SessionItem } from '../../engine/session';
import { formatDuration, percent } from '../../lib/format';
import { summaryMessage } from '../../lib/messages';

function ScoreRing({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = pct >= 75 ? 'stroke-emerald-500' : pct >= 50 ? 'stroke-amber-500' : 'stroke-rose-500';
  return (
    <div className="relative size-36">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} strokeWidth="12" className="fill-none stroke-slate-200 dark:stroke-slate-800" />
        <circle
          cx="60"
          cy="60"
          r={r}
          strokeWidth="12"
          strokeLinecap="round"
          className={`fill-none transition-[stroke-dashoffset] duration-1000 ${color}`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-3xl font-extrabold tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
      <div className={`text-2xl font-extrabold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

export function ReviewItem({ item, n }: { item: SessionItem; n: number }) {
  const [open, setOpen] = useState(item.result !== 'correct');
  const icon =
    item.result === 'correct' ? (
      <CheckIcon className="text-emerald-500" />
    ) : item.result === 'timeout' ? (
      <ClockIcon className="text-amber-500" />
    ) : (
      <XIcon className="text-rose-500" />
    );
  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-start"
      >
        {icon}
        <span className="font-bold">שאלה {n}</span>
        <span className="truncate text-sm text-slate-500 dark:text-slate-400">{item.question.passage ? `${item.question.passage.title}: ` : ''}
          {item.question.prompt.map(contentLabel).join(' ')}</span>
        <ChevronDownIcon className={`ms-auto shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-800">
          <QuestionMeta question={item.question} />
          <QuestionPrompt question={item.question} />
          <ChoiceList question={item.question} order={item.order} chosen={item.chosen} reveal disabled onChoose={() => {}} />
          {item.result === 'timeout' && <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">לא נענתה בזמן</p>}
          <p className="leading-relaxed text-slate-700 dark:text-slate-200">
            <span className="font-bold">הסבר: </span>
            {item.question.explanation}
          </p>
        </div>
      )}
    </Card>
  );
}

export function SessionSummary({
  items,
  reward,
  onRestart,
  onExit,
}: {
  items: SessionItem[];
  reward: Reward | null;
  onRestart: () => void;
  onExit: () => void;
}) {
  const answered = items.filter((i) => i.result !== null);
  const correct = answered.filter((i) => i.result === 'correct').length;
  const wrong = answered.filter((i) => i.result === 'wrong').length;
  const timeout = answered.filter((i) => i.result === 'timeout').length;
  const pct = percent(correct, answered.length);
  const avg = answered.length ? answered.reduce((s, i) => s + i.timeMs, 0) / answered.length : 0;

  if (answered.length === 0) {
    return (
      <Card className="space-y-4 p-8 text-center">
        <p className="text-lg font-bold">לא נענו שאלות בתרגול הזה.</p>
        <div className="flex justify-center gap-3">
          <Button onClick={onRestart}>תרגול חדש</Button>
          <Button variant="secondary" onClick={onExit}>
            חזרה לדף הבית
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="animate-rise flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
        <ScoreRing pct={pct} />
        <div className="w-full flex-1 space-y-4 text-center sm:text-start">
          <div>
            <h2 className="text-2xl font-extrabold">סיכום התרגול</h2>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{summaryMessage(pct)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="נכונות" value={String(correct)} tone="text-emerald-600 dark:text-emerald-400" />
            <Stat label="שגויות" value={String(wrong)} tone="text-rose-600 dark:text-rose-400" />
            <Stat label="לא נענו" value={String(timeout)} tone="text-amber-600 dark:text-amber-400" />
            <Stat label="זמן ממוצע" value={formatDuration(avg)} tone="text-slate-800 dark:text-slate-100" />
          </div>
          <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
            <Button onClick={onRestart}>תרגול נוסף</Button>
            <Button variant="secondary" onClick={onExit}>
              חזרה לדף הבית
            </Button>
          </div>
        </div>
      </Card>

      {reward && <RewardPanel reward={reward} />}

      <section className="space-y-3">
        <h3 className="text-lg font-bold">מעבר על השאלות</h3>
        {answered.map((item, i) => (
          <ReviewItem key={item.question.id + i} item={item} n={i + 1} />
        ))}
      </section>
    </div>
  );
}
