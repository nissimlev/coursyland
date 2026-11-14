import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RewardPanel } from '../components/RewardPanel';
import { ChoiceList } from '../components/question/ChoiceList';
import { QuestionPrompt } from '../components/question/QuestionPrompt';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ArrowLeftIcon, ClockIcon } from '../components/ui/Icons';
import { SIMULATION_CONFIG } from '../config/simulation.config';
import type { Reward } from '../engine/gamification';
import { estimateDapar, sectionScore, weightedPct } from '../engine/scoring';
import { buildExam, type ExamSection } from '../features/simulation/buildExam';
import { ReviewItem } from '../features/practice/SessionSummary';
import { TOPICS } from '../questions/topics';
import type { ChoiceId } from '../questions/types';
import { useProgress, type Attempt, type SimulationRecord } from '../store/progress';
import { PageHeader } from './PracticePage';

const META = {
  name: 'סימולציית מבחן דפ״ר',
  description: 'ארבעה פרקים עם זמן מוגבל לכל פרק, בלי משוב עד הסוף',
  emoji: '📝',
  gradient: 'from-indigo-600 to-violet-500',
};

type Phase = 'intro' | 'section' | 'between' | 'results';

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, '0')}`;

function SectionTimer({ deadline, totalSec, onExpire }: { deadline: number; totalSec: number; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, (deadline - Date.now()) / 1000));
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  useEffect(() => {
    let done = false;
    const id = window.setInterval(() => {
      const l = Math.max(0, (deadline - Date.now()) / 1000);
      setLeft(l);
      if (l <= 0 && !done) {
        done = true;
        expireRef.current();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [deadline]);
  const frac = left / totalSec;
  const tone =
    frac > 0.25
      ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
      : frac > 0.1
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
        : 'animate-pulse-soft bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
  return (
    <span role="timer" aria-label={`נשארו ${mmss(left)} דקות בפרק`} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold tabular-nums ${tone}`}>
      <ClockIcon width={18} height={18} />
      {mmss(left)}
    </span>
  );
}

export function SimulationPage() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [sections, setSections] = useState<ExamSection[]>([]);
  const [sIdx, setSIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [result, setResult] = useState<{ record: SimulationRecord; reward: Reward } | null>(null);
  const enteredAt = useRef(Date.now());
  const sectionStart = useRef(Date.now());
  const examStart = useRef(Date.now());
  const commitSession = useProgress((s) => s.commitSession);

  // אזהרה לפני יציאה מהעמוד באמצע מבחן
  useEffect(() => {
    if (phase !== 'section' && phase !== 'between') return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [phase]);

  /** מוסיף לשאלה הנוכחית את הזמן שהושקע בה */
  const accrueTime = useCallback(
    (secs: ExamSection[]) => {
      const now = Date.now();
      const copy = secs.map((s) => ({ ...s, items: [...s.items] }));
      const item = copy[sIdx]?.items[qIdx];
      if (item) copy[sIdx].items[qIdx] = { ...item, timeMs: item.timeMs + (now - enteredAt.current) };
      enteredAt.current = now;
      return copy;
    },
    [sIdx, qIdx],
  );

  const startSection = (idx: number) => {
    const sec = SIMULATION_CONFIG.sections[idx];
    setSIdx(idx);
    setQIdx(0);
    sectionStart.current = Date.now();
    enteredAt.current = Date.now();
    setDeadline(Date.now() + sec.minutes * 60_000);
    setPhase('section');
    window.scrollTo({ top: 0 });
  };

  const startExam = () => {
    setSections(buildExam());
    setResult(null);
    examStart.current = Date.now();
    startSection(0);
  };

  const goTo = (i: number) => {
    setSections(accrueTime(sectionsRef.current));
    setQIdx(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const choose = (id: ChoiceId) =>
    setSections((s) => {
      const copy = s.map((x) => ({ ...x, items: [...x.items] }));
      const item = copy[sIdx].items[qIdx];
      copy[sIdx].items[qIdx] = { ...item, chosen: item.chosen === id ? null : id };
      return copy;
    });

  const toggleFlag = () =>
    setSections((s) => {
      const copy = s.map((x) => ({ ...x, flagged: [...x.flagged] }));
      copy[sIdx].flagged[qIdx] = !copy[sIdx].flagged[qIdx];
      return copy;
    });

  const finishExam = (secs: ExamSection[]) => {
    const graded = secs.map((s) => ({
      ...s,
      items: s.items.map((i) => ({
        ...i,
        result: i.chosen === null ? ('timeout' as const) : i.chosen === i.question.correctChoiceId ? ('correct' as const) : ('wrong' as const),
      })),
    }));
    setSections(graded);
    const now = Date.now();
    const sectionResults = graded.map((s) => {
      const pct = weightedPct(s.items.map((i) => ({ difficulty: i.question.difficulty, correct: i.result === 'correct' })));
      return {
        topic: s.config.topic,
        correct: s.items.filter((i) => i.result === 'correct').length,
        total: s.items.length,
        score: sectionScore(pct),
        timeUsedSec: s.timeUsedSec,
        pct,
      };
    });
    const id = `sim-${now.toString(36)}`;
    const record: SimulationRecord = {
      id,
      at: now,
      durationSec: Math.round((now - examStart.current) / 1000),
      estimated: estimateDapar(sectionResults),
      answered: graded.flatMap((s) => s.items).filter((i) => i.chosen !== null).length,
      sections: sectionResults.map(({ pct: _pct, ...r }) => r),
    };
    const all = graded.flatMap((s) => s.items);
    const attempts: Attempt[] = all.map((i) => ({
      qid: i.question.id,
      topic: i.question.topic,
      subtopic: i.question.subtopic,
      difficulty: i.question.difficulty,
      result: i.result!,
      timeMs: i.timeMs,
      at: now,
      sessionId: id,
    }));
    const reward = commitSession(
      {
        id,
        mode: 'simulation',
        topics: graded.map((s) => s.config.topic),
        difficulty: 'mixed',
        total: all.length,
        correct: all.filter((i) => i.result === 'correct').length,
        wrong: all.filter((i) => i.result === 'wrong').length,
        timeout: all.filter((i) => i.result === 'timeout').length,
        avgTimeMs: Math.round(all.reduce((s, i) => s + i.timeMs, 0) / Math.max(1, all.length)),
        startedAt: examStart.current,
        endedAt: now,
      },
      attempts,
      record,
    );
    setResult({ record, reward });
    setPhase('results');
    window.scrollTo({ top: 0 });
  };

  // הפונקציות עם תופעות לוואי קוראות את המצב העדכני מ-ref ולא מתוך updater (בטוח ב-StrictMode)
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const endSection = () => {
    if (phaseRef.current !== 'section') return; // מונע סיום כפול (טיימר + לחיצה)
    phaseRef.current = 'between';
    setConfirmEnd(false);
    const s = accrueTime(sectionsRef.current);
    s[sIdx] = { ...s[sIdx], timeUsedSec: Math.round((Date.now() - sectionStart.current) / 1000) };
    if (sIdx === s.length - 1) finishExam(s);
    else {
      setSections(s);
      setPhase('between');
    }
  };

  const section = sections[sIdx];
  const item = section?.items[qIdx];

  // מקלדת: 1–4 לבחירה, Enter לשאלה הבאה
  useEffect(() => {
    if (phase !== 'section' || !item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-4]$/.test(e.key)) {
        e.preventDefault();
        choose(item.order[Number(e.key) - 1]);
      } else if (e.key === 'Enter' && qIdx < section.items.length - 1) {
        e.preventDefault();
        goTo(qIdx + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- מסכים ----------

  if (phase === 'intro') {
    const totalQ = SIMULATION_CONFIG.sections.reduce((s, x) => s + x.questions, 0);
    const totalMin = SIMULATION_CONFIG.sections.reduce((s, x) => s + x.minutes, 0);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader meta={META} />
        <Card className="space-y-6 p-6 sm:p-8">
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-start text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <tr>
                  <th className="p-3 text-start">פרק</th>
                  <th className="p-3 text-start">שאלות</th>
                  <th className="p-3 text-start">זמן</th>
                </tr>
              </thead>
              <tbody>
                {SIMULATION_CONFIG.sections.map((s, i) => (
                  <tr key={s.topic} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="p-3 font-semibold">
                      {i + 1}. {TOPICS[s.topic].name}
                    </td>
                    <td className="p-3 tabular-nums">{s.questions}</td>
                    <td className="p-3 tabular-nums">{s.minutes} דק׳</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 bg-slate-50 font-bold dark:border-slate-800 dark:bg-slate-800/40">
                  <td className="p-3">סך הכול</td>
                  <td className="p-3 tabular-nums">{totalQ}</td>
                  <td className="p-3 tabular-nums">{totalMin} דק׳</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="list-disc space-y-1.5 ps-5 text-slate-700 dark:text-slate-300">
            <li>לכל פרק יש זמן כולל. כשהזמן נגמר, הפרק נסגר, ושאלות שלא נענו נספרות כ״לא נענו״.</li>
            <li>אין משוב במהלך המבחן. את התשובות וההסברים רואים בסוף.</li>
            <li>בתוך פרק אפשר לעבור בין שאלות, לשנות תשובה ולסמן שאלה ״לחזור אליה״. לפרק שהסתיים אי אפשר לחזור.</li>
            <li>בסוף מקבלים ציון לכל פרק (1–9) וציון משוקלל מוערך (10–90).</li>
          </ul>
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            המבנה מבוסס על המידע הציבורי על המבחן. המבחן האמיתי אדפטיבי ולא מאפשר לחזור לשאלות קודמות. מקורות:{' '}
            {SIMULATION_CONFIG.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ' · '}
                <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                  {s.label}
                </a>
              </span>
            ))}
          </p>
          <div className="flex justify-end">
            <Button size="lg" onClick={startExam}>
              להתחיל את המבחן
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === 'between') {
    const next = SIMULATION_CONFIG.sections[sIdx + 1];
    return (
      <Card className="mx-auto max-w-xl animate-rise space-y-4 p-8 text-center">
        <div className="text-5xl" aria-hidden>
          ☕
        </div>
        <h2 className="text-2xl font-extrabold">פרק {sIdx + 1} הסתיים</h2>
        <p className="text-slate-600 dark:text-slate-300">
          הפרק הבא: <b>{TOPICS[next.topic].name}</b>. {next.questions} שאלות, {next.minutes} דקות.
        </p>
        <Button size="lg" onClick={() => startSection(sIdx + 1)}>
          להתחיל את פרק {sIdx + 2}
        </Button>
      </Card>
    );
  }

  if (phase === 'results' && result) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader meta={META} />
        <Card className="animate-rise space-y-6 p-6 text-center sm:p-8">
          <div>
            <p className="font-semibold text-slate-500 dark:text-slate-400">ציון דפ״ר מוערך</p>
            <p className="bg-gradient-to-br from-violet-600 to-fuchsia-500 bg-clip-text text-7xl font-black text-transparent tabular-nums">
              {result.record.estimated}
            </p>
            <p className="mx-auto mt-2 max-w-lg rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              ⚠️ זו הערכה בלבד, לפי אחוז ההצלחה המשוקלל בסימולציה הזו. זה לא ציון רשמי, והנוסחה של צה״ל לא פורסמה.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {result.record.sections.map((s) => (
              <div key={s.topic} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <div className="text-3xl font-extrabold tabular-nums">{s.score}</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">מתוך 9</div>
                <div className="mt-1 text-sm font-bold">{TOPICS[s.topic].short}</div>
                <div className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {s.correct}/{s.total} נכונות · {mmss(s.timeUsedSec)}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => setPhase('intro')}>מבחן נוסף</Button>
            <Link to="/progress" className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700">
              להתקדמות שלי
            </Link>
          </div>
        </Card>
        <RewardPanel reward={result.reward} />
        {sections.map((s, si) => (
          <section key={s.config.topic} className="space-y-3">
            <h3 className="text-lg font-bold">
              פרק {si + 1}: {TOPICS[s.config.topic].name}
            </h3>
            {s.items.map((it, i) => (
              <ReviewItem key={it.question.id + i} item={it} n={i + 1} />
            ))}
          </section>
        ))}
      </div>
    );
  }

  if (!section || !item) return null;
  const answered = section.items.filter((i) => i.chosen !== null).length;
  const unanswered = section.items.length - answered;
  const flaggedCount = section.flagged.filter(Boolean).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            פרק {sIdx + 1} מתוך {sections.length}
          </p>
          <h1 className="text-xl font-extrabold">{TOPICS[section.config.topic].name}</h1>
        </div>
        <SectionTimer key={sIdx} deadline={deadline} totalSec={section.config.minutes * 60} onExpire={endSection} />
      </div>

      {/* ניווט בין השאלות בפרק */}
      <nav aria-label="ניווט בין שאלות" className="flex flex-wrap gap-1.5">
        {section.items.map((it, i) => {
          const current = i === qIdx;
          const flagged = section.flagged[i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-current={current}
              aria-label={`שאלה ${i + 1}${it.chosen ? ', נענתה' : ''}${flagged ? ', מסומנת לחזרה' : ''}`}
              className={`relative grid size-9 place-items-center rounded-lg text-sm font-bold tabular-nums transition-colors ${
                current
                  ? 'bg-violet-600 text-white dark:bg-violet-500'
                  : it.chosen
                    ? 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {i + 1}
              {flagged && <span className="absolute -top-1 -end-1 text-xs" aria-hidden>🚩</span>}
            </button>
          );
        })}
      </nav>

      <Card key={`${sIdx}-${qIdx}`} className="animate-rise space-y-6 p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
            שאלה {qIdx + 1} מתוך {section.items.length}
          </span>
          <button
            type="button"
            onClick={toggleFlag}
            aria-pressed={section.flagged[qIdx]}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
              section.flagged[qIdx]
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            🚩 {section.flagged[qIdx] ? 'מסומנת לחזרה' : 'לחזור אליה'}
          </button>
        </div>
        <QuestionPrompt question={item.question} />
        <ChoiceList question={item.question} order={item.order} chosen={item.chosen} reveal={false} disabled={false} onChoose={choose} />
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" disabled={qIdx === 0} onClick={() => goTo(qIdx - 1)}>
          הקודמת
        </Button>
        {qIdx < section.items.length - 1 ? (
          <Button onClick={() => goTo(qIdx + 1)}>
            הבאה <ArrowLeftIcon width={18} height={18} />
          </Button>
        ) : (
          <Button onClick={() => setConfirmEnd(true)}>סיום הפרק</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-900">
        <span>
          נענו {answered} מתוך {section.items.length}
          {flaggedCount > 0 && ` · ${flaggedCount} מסומנות לחזרה`}
        </span>
        <button type="button" onClick={() => setConfirmEnd(true)} className="font-bold text-violet-700 hover:underline dark:text-violet-300">
          לסיים את הפרק עכשיו
        </button>
      </div>

      {confirmEnd && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="end-title" className="fixed inset-0 z-30 grid place-items-center bg-slate-950/50 p-4">
          <Card className="animate-rise max-w-sm space-y-4 p-6 text-center">
            <h2 id="end-title" className="text-lg font-extrabold">
              לסיים את הפרק?
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              {unanswered === 1 ? 'נשארה שאלה אחת בלי תשובה. ' : unanswered > 1 ? `נשארו ${unanswered} שאלות בלי תשובה. ` : ''}
              {flaggedCount === 1 ? 'שאלה אחת מסומנת לחזרה. ' : flaggedCount > 1 ? `${flaggedCount} שאלות מסומנות לחזרה. ` : ''}
              אחרי הסיום אי אפשר לחזור לפרק הזה.
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={endSection}>כן, לסיים</Button>
              <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
                לחזור לפרק
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
