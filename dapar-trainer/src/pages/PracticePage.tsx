import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { SessionSettings } from '../engine/session';
import { PracticeRunner } from '../features/practice/PracticeRunner';
import { PracticeSetup } from '../features/practice/PracticeSetup';
import { isTopicAvailable } from '../questions/bank';
import { TOPIC_ORDER, TOPICS } from '../questions/topics';
import type { Topic } from '../questions/types';
import { useSettings, type PracticePrefs } from '../store/settings';

const MIXED_META = {
  name: 'תרגול מעורב',
  description: 'שאלות מכל הנושאים ביחד, כמו בחזרה כללית לפני המבחן',
  emoji: '🎲',
  gradient: 'from-fuchsia-500 to-rose-400',
};

export function PageHeader({ meta }: { meta: { name: string; description: string; emoji: string; gradient: string } }) {
  return (
    <header className="flex items-center gap-4">
      <span className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-3xl shadow-sm ${meta.gradient}`} aria-hidden>
        {meta.emoji}
      </span>
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{meta.name}</h1>
        <p className="text-slate-600 dark:text-slate-400">{meta.description}</p>
      </div>
    </header>
  );
}

export function PracticePage() {
  const { topic } = useParams<{ topic: string }>();
  const navigate = useNavigate();
  const prefs = useSettings((s) => s.practice);
  const setPrefs = useSettings((s) => s.setPractice);
  const [session, setSession] = useState<SessionSettings | null>(null);
  const [runId, setRunId] = useState(0);

  const mixed = topic === 'mixed';
  if (!mixed && (!topic || !(topic in TOPICS) || !isTopicAvailable(topic as Topic))) return <Navigate to="/" replace />;
  const meta = mixed ? MIXED_META : TOPICS[topic as Topic];
  const topics: Topic[] = mixed ? TOPIC_ORDER.filter(isTopicAvailable) : [topic as Topic];

  const start = (p: PracticePrefs) => {
    setPrefs(p);
    setSession({ mode: mixed ? 'mixed' : 'topic', topics, difficulty: p.difficulty, count: p.count, timePerQuestionSec: p.timePerQuestionSec });
    setRunId((n) => n + 1);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader meta={meta} />
      {session ? (
        <PracticeRunner
          key={runId}
          settings={session}
          onRestart={() => {
            setSession(null);
            window.scrollTo({ top: 0 });
          }}
          onExit={() => navigate('/')}
        />
      ) : (
        <PracticeSetup initial={prefs} onStart={start} />
      )}
    </div>
  );
}
