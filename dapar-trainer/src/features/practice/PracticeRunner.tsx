import { useEffect, useMemo, useRef } from 'react';
import { ChoiceList } from '../../components/question/ChoiceList';
import { QuestionMeta, QuestionPrompt } from '../../components/question/QuestionPrompt';
import { TimerBar } from '../../components/question/TimerBar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ArrowLeftIcon } from '../../components/ui/Icons';
import { XP_PER_CORRECT } from '../../engine/gamification';
import type { SessionSettings } from '../../engine/session';
import { CORRECT_MESSAGES, randomOf, TIMEOUT_MESSAGES, WRONG_MESSAGES } from '../../lib/messages';
import { SessionSummary } from './SessionSummary';
import { usePracticeSession } from './usePracticeSession';

function ProgressDots({ results, total, index }: { results: (string | null)[]; total: number; index: number }) {
  if (total > 30) {
    return (
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${(results.filter(Boolean).length / total) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        const c =
          r === 'correct' ? 'bg-emerald-500' : r === 'wrong' ? 'bg-rose-500' : r === 'timeout' ? 'bg-amber-400' : i === index ? 'bg-violet-400' : 'bg-slate-200 dark:bg-slate-800';
        return <div key={i} className={`h-2 flex-1 rounded-full transition-colors ${c}`} />;
      })}
    </div>
  );
}

export function PracticeRunner({ settings, onRestart, onExit }: { settings: SessionSettings; onRestart: () => void; onExit: () => void }) {
  const s = usePracticeSession(settings);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  // מקלדת: 1–4 לבחירה, Enter להמשך
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (s.phase === 'answering' && s.current && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        s.answer(s.current.order[Number(e.key) - 1]);
      } else if (s.phase === 'feedback' && e.key === 'Enter') {
        e.preventDefault();
        s.next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  // אחרי תשובה: פוקוס לכפתור "הבא" (נגישות)
  useEffect(() => {
    if (s.phase === 'feedback') nextBtnRef.current?.focus({ preventScroll: true });
  }, [s.phase]);

  const item = s.current;
  const feedbackText = useMemo(() => {
    if (!item?.result) return '';
    return randomOf(item.result === 'correct' ? CORRECT_MESSAGES : item.result === 'timeout' ? TIMEOUT_MESSAGES : WRONG_MESSAGES);
  }, [item?.result, item?.question.id]);

  if (s.phase === 'done' || !item) {
    return <SessionSummary items={s.items} reward={s.reward} onRestart={onRestart} onExit={onExit} />;
  }

  const isLast = s.items.length >= s.total;
  const results = s.items.map((i) => i.result);
  const feedback = s.phase === 'feedback';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
            שאלה {s.index + 1} מתוך {s.total}
          </span>
          <Button variant="ghost" onClick={s.finishEarly} className="h-8 px-3 text-xs">
            סיום תרגול
          </Button>
        </div>
        <ProgressDots results={results} total={s.total} index={s.index} />
        {settings.timePerQuestionSec !== null && (
          <TimerBar key={item.question.id + s.index} durationSec={settings.timePerQuestionSec} running={s.phase === 'answering'} onExpire={s.timeout} />
        )}
      </div>

      <Card key={item.question.id + s.index} className="animate-rise space-y-6 p-5 sm:p-7">
        <QuestionMeta question={item.question} showTopic={settings.mode !== 'topic'} />
        <QuestionPrompt question={item.question} />
        <ChoiceList
          question={item.question}
          order={item.order}
          chosen={item.chosen}
          reveal={feedback}
          disabled={feedback}
          onChoose={s.answer}
        />
      </Card>

      {feedback && (
        <div
          role="status"
          className={`animate-rise relative rounded-2xl border-2 p-5 sm:p-6 ${
            item.result === 'correct'
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
              : item.result === 'timeout'
                ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                : 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
          }`}
        >
          {item.result === 'correct' && (
            <span className="animate-float-up pointer-events-none absolute -top-3 end-6 rounded-full bg-emerald-500 px-3 py-1 text-sm font-bold text-white shadow">
              +{XP_PER_CORRECT[item.question.difficulty]} XP
            </span>
          )}
          <p
            className={`text-lg font-extrabold ${
              item.result === 'correct'
                ? 'text-emerald-700 dark:text-emerald-300'
                : item.result === 'timeout'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-rose-700 dark:text-rose-300'
            }`}
          >
            {feedbackText}
          </p>
          <p className="mt-2 leading-relaxed text-slate-700 dark:text-slate-200">
            <span className="font-bold">הסבר: </span>
            {item.question.explanation}
          </p>
          <div className="mt-5 flex justify-end">
            <Button ref={nextBtnRef} size="lg" onClick={s.next} className="w-full sm:w-auto">
              {isLast ? 'לסיכום' : 'לשאלה הבאה'}
              <ArrowLeftIcon width={18} height={18} />
              <kbd className="hidden rounded bg-white/20 px-1.5 text-xs font-medium sm:inline">Enter</kbd>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
