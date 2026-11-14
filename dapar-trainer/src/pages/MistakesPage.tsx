import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Segmented } from '../components/ui/Segmented';
import type { SessionSettings } from '../engine/session';
import { PracticeRunner } from '../features/practice/PracticeRunner';
import { getQuestionById } from '../questions/bank';
import { TOPIC_ORDER, TOPICS } from '../questions/topics';
import type { Topic } from '../questions/types';
import { MISTAKE_CLEAR_AFTER, useProgress } from '../store/progress';
import { PageHeader } from './PracticePage';

const META = {
  name: 'מאגר טעויות',
  description: `תרגול חוזר על שאלות שטעית בהן. שאלה יוצאת מהמאגר אחרי ${MISTAKE_CLEAR_AFTER} תשובות נכונות ברצף.`,
  emoji: '🔁',
  gradient: 'from-orange-500 to-amber-400',
};

export function MistakesPage() {
  const navigate = useNavigate();
  const mistakes = useProgress((s) => s.mistakes);
  const [filter, setFilter] = useState<Topic | 'all'>('all');
  const [session, setSession] = useState<SessionSettings | null>(null);
  const [runId, setRunId] = useState(0);

  // רק שאלות שעדיין קיימות ולא מסומנות לבדיקה
  const entries = useMemo(
    () =>
      Object.values(mistakes)
        .filter((m) => {
          const q = getQuestionById(m.qid);
          return q && !q.needsReview;
        })
        .sort((a, b) => b.lastWrongAt - a.lastWrongAt),
    [mistakes],
  );
  const byTopic = (t: Topic) => entries.filter((e) => e.topic === t).length;
  const selected = filter === 'all' ? entries : entries.filter((e) => e.topic === filter);

  const start = () => {
    setSession({
      mode: 'mistakes',
      topics: TOPIC_ORDER,
      difficulty: 'mixed',
      count: Math.min(20, selected.length),
      timePerQuestionSec: null,
      questionIds: selected.slice(0, 20).map((e) => e.qid),
    });
    setRunId((n) => n + 1);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader meta={META} />
      {session ? (
        <PracticeRunner key={runId} settings={session} onRestart={() => setSession(null)} onExit={() => navigate('/')} />
      ) : entries.length === 0 ? (
        <Card className="space-y-3 p-8 text-center">
          <div className="text-5xl" aria-hidden>
            ✨
          </div>
          <p className="text-lg font-bold">מאגר הטעויות ריק</p>
          <p className="text-slate-600 dark:text-slate-400">כל שאלה שתהיה בה טעות תיכנס לכאן, כדי שאפשר יהיה לחזור אליה בהמשך.</p>
          <Link to="/" className="inline-block font-semibold text-violet-700 hover:underline dark:text-violet-300">
            לתרגול
          </Link>
        </Card>
      ) : (
        <Card className="space-y-6 p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TOPIC_ORDER.map((t) => (
              <div key={t} className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
                <div className="text-2xl font-extrabold tabular-nums">{byTopic(t)}</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{TOPICS[t].name}</div>
              </div>
            ))}
          </div>
          <fieldset className="space-y-3">
            <legend className="font-bold">על מה לחזור?</legend>
            <Segmented<Topic | 'all'>
              label="נושא"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `הכול (${entries.length})` },
                ...TOPIC_ORDER.filter((t) => byTopic(t) > 0).map((t) => ({ value: t, label: `${TOPICS[t].short} (${byTopic(t)})` })),
              ]}
            />
          </fieldset>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {selected.length > 20 ? 'נתרגל את 20 הטעויות האחרונות.' : `נתרגל ${selected.length} שאלות.`}
            </p>
            <Button size="lg" onClick={start} disabled={selected.length === 0}>
              לתרגל טעויות
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
