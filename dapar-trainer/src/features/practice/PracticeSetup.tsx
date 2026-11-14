import { useState, type ReactNode } from 'react';
import { ADAPTIVE_DOWN_AFTER, ADAPTIVE_UP_AFTER } from '../../engine/adaptive';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Segmented } from '../../components/ui/Segmented';
import type { DifficultySetting } from '../../questions/types';
import type { PracticePrefs } from '../../store/settings';

const COUNT_OPTIONS = [5, 10, 20, 30];
const TIME_OPTIONS = [30, 45, 60, 90];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-bold">{label}</legend>
      {hint && <p className="-mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
      {children}
    </fieldset>
  );
}

const numberInput =
  'h-10 w-24 rounded-xl border border-slate-300 bg-white px-3 text-center font-semibold tabular-nums focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-slate-600 dark:bg-slate-800';

export function PracticeSetup({
  initial,
  onStart,
}: {
  initial: PracticePrefs;
  onStart: (prefs: PracticePrefs) => void;
}) {
  const [difficulty, setDifficulty] = useState<DifficultySetting>(initial.difficulty);
  const [count, setCount] = useState(initial.count);
  const [customCount, setCustomCount] = useState(!COUNT_OPTIONS.includes(initial.count));
  const [time, setTime] = useState<number | null>(initial.timePerQuestionSec);
  const [customTime, setCustomTime] = useState(initial.timePerQuestionSec !== null && !TIME_OPTIONS.includes(initial.timePerQuestionSec));

  const start = () => onStart({ difficulty, count: clamp(count || 10, 1, 100), timePerQuestionSec: time === null ? null : clamp(time || 60, 10, 600) });

  return (
    <Card className="animate-rise space-y-7 p-6 sm:p-8">
      <Field
        label="רמת קושי"
        hint={
          difficulty === 'adaptive'
            ? `מתחילים בבינוני. אחרי ${ADAPTIVE_UP_AFTER} תשובות נכונות ברצף הקושי עולה, ואחרי ${ADAPTIVE_DOWN_AFTER} טעויות ברצף הוא יורד.`
            : difficulty === 'mixed'
              ? 'שאלות מכל רמות הקושי, בערבוב.'
              : undefined
        }
      >
        <Segmented<DifficultySetting>
          label="רמת קושי"
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: 'easy', label: 'קל' },
            { value: 'medium', label: 'בינוני' },
            { value: 'hard', label: 'קשה' },
            { value: 'mixed', label: 'מעורב' },
            { value: 'adaptive', label: 'אדפטיבי ✨' },
          ]}
        />
      </Field>

      <Field label="מספר שאלות">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<string>
            label="מספר שאלות"
            value={customCount ? 'custom' : String(count)}
            onChange={(v) => {
              if (v === 'custom') setCustomCount(true);
              else {
                setCustomCount(false);
                setCount(Number(v));
              }
            }}
            options={[...COUNT_OPTIONS.map((n) => ({ value: String(n), label: String(n) })), { value: 'custom', label: 'אחר' }]}
          />
          {customCount && (
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              aria-label="מספר שאלות מותאם"
              className={numberInput}
              value={count || ''}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          )}
        </div>
      </Field>

      <Field label="זמן לשאלה" hint="כשהזמן נגמר, השאלה נספרת כ״לא נענתה״ ועוברים הלאה.">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<string>
            label="זמן לשאלה"
            value={time === null ? 'none' : customTime ? 'custom' : String(time)}
            onChange={(v) => {
              if (v === 'none') {
                setTime(null);
                setCustomTime(false);
              } else if (v === 'custom') {
                setCustomTime(true);
                setTime((t) => t ?? 60);
              } else {
                setCustomTime(false);
                setTime(Number(v));
              }
            }}
            options={[
              { value: 'none', label: 'בלי טיימר' },
              ...TIME_OPTIONS.map((n) => ({ value: String(n), label: `${n} שנ׳` })),
              { value: 'custom', label: 'מותאם' },
            ]}
          />
          {customTime && time !== null && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="number"
                inputMode="numeric"
                min={10}
                max={600}
                aria-label="שניות לשאלה"
                className={numberInput}
                value={time || ''}
                onChange={(e) => setTime(Number(e.target.value))}
              />
              שניות
            </label>
          )}
        </div>
      </Field>

      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          טיפ: אפשר לענות עם המקשים <kbd className="font-sans font-bold">1–4</kbd> ולעבור הלאה עם <kbd className="font-sans font-bold">Enter</kbd>.
        </p>
        <Button size="lg" onClick={start} className="sm:min-w-44">
          יאללה, מתחילים
        </Button>
      </div>
    </Card>
  );
}
