import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarList, LineChart } from '../components/charts/Charts';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { BADGES, levelProgress, liveStreak } from '../engine/gamification';
import { bucket, byDifficulty, byTopic, dailySeries, recommend, recommendationTitle } from '../engine/stats';
import { formatDuration } from '../lib/format';
import { DIFFICULTY_NAMES, TOPIC_ORDER, TOPICS } from '../questions/topics';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { PageHeader } from './PracticePage';

const META = { name: 'ההתקדמות שלי', description: 'אחוזי הצלחה, זמנים, היסטוריית מבחנים והישגים', emoji: '📈', gradient: 'from-emerald-500 to-teal-400' };

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </Card>
  );
}

export function LevelCard() {
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const lp = levelProgress(xp);
  const days = liveStreak(streak, Date.now());
  return (
    <Card className="flex flex-wrap items-center gap-5">
      <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-2xl font-black text-white">
        {lp.level}
      </div>
      <div className="min-w-48 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-extrabold">{lp.rank}</span>
          <span className="text-sm text-slate-500 tabular-nums dark:text-slate-400">
            {lp.into}/{lp.span} XP לרמה הבאה
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={lp.pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-l from-violet-600 to-fuchsia-500 transition-[width] duration-700" style={{ width: `${lp.pct}%` }} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">סך הכול {xp} XP</div>
      </div>
      <div className="text-center">
        <div className="text-3xl" aria-hidden>
          🔥
        </div>
        <div className="text-sm font-extrabold tabular-nums">{days} ימים ברצף</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">שיא: {streak.best}</div>
      </div>
    </Card>
  );
}

export function ProgressPage() {
  const navigate = useNavigate();
  const attempts = useProgress((s) => s.attempts);
  const simulations = useProgress((s) => s.simulations);
  const badges = useProgress((s) => s.badges);
  const resetAll = useProgress((s) => s.resetAll);
  const setPractice = useSettings((s) => s.setPractice);
  const prefs = useSettings((s) => s.practice);
  const [confirmReset, setConfirmReset] = useState(false);

  const all = bucket(attempts);
  const topics = byTopic(attempts);
  const diffs = byDifficulty(attempts);
  const daily = dailySeries(attempts);
  const rec = recommend(attempts);

  const fmtDay = (d: string) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}`;

  return (
    <div className="space-y-6">
      <PageHeader meta={META} />
      <LevelCard />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="שאלות שנענו" value={String(all.total)} />
        <Tile label="אחוז הצלחה" value={all.pct === null ? '–' : `${all.pct}%`} sub={`${all.correct} נכונות`} />
        <Tile label="זמן ממוצע לשאלה" value={all.avgTimeMs === null ? '–' : formatDuration(all.avgTimeMs)} />
        <Tile label="מבחנים" value={String(simulations.length)} sub={simulations.length ? `הכי גבוה: ${Math.max(...simulations.map((s) => s.estimated))}` : undefined} />
      </div>

      <Card className="flex flex-col gap-4 border-violet-200 bg-violet-50/60 sm:flex-row sm:items-center dark:border-violet-500/30 dark:bg-violet-500/5">
        <div className="text-4xl" aria-hidden>
          {TOPICS[rec.topic].emoji}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-violet-700 dark:text-violet-300">ההמלצה לעכשיו</p>
          <p className="text-lg font-extrabold">
            {recommendationTitle(rec, TOPICS[rec.topic].name, DIFFICULTY_NAMES[rec.difficulty])}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{rec.reason}</p>
        </div>
        <Button
          onClick={() => {
            setPractice({ ...prefs, difficulty: rec.difficulty });
            navigate(`/practice/${rec.topic}`);
          }}
        >
          לתרגל עכשיו
        </Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="font-bold">הצלחה לפי נושא</h2>
          <BarList
            rows={TOPIC_ORDER.map((t) => ({
              label: TOPICS[t].name,
              value: topics[t].pct,
              detail: topics[t].total ? `${topics[t].total} שאלות · ${formatDuration(topics[t].avgTimeMs ?? 0)} בממוצע` : 'עוד לא תרגלת',
            }))}
          />
        </Card>
        <Card className="space-y-4">
          <h2 className="font-bold">הצלחה לפי רמת קושי</h2>
          <BarList
            rows={(['easy', 'medium', 'hard'] as const).map((d) => ({
              label: DIFFICULTY_NAMES[d],
              value: diffs[d].pct,
              detail: diffs[d].total ? `${diffs[d].total} שאלות · ${formatDuration(diffs[d].avgTimeMs ?? 0)} בממוצע` : 'אין נתונים',
            }))}
          />
        </Card>
      </div>

      <Card className="space-y-3">
        <h2 className="font-bold">אחוז הצלחה לאורך זמן</h2>
        {daily.length < 2 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">הגרף יופיע אחרי תרגול בשני ימים שונים לפחות.</p>
        ) : (
          <>
            <LineChart points={daily.map((d) => ({ label: fmtDay(d.day), value: d.pct, detail: `${d.total} שאלות` }))} />
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500 dark:text-slate-400">הצגה כטבלה</summary>
              <table className="mt-2 w-full text-start">
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.day} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="py-1">{fmtDay(d.day)}</td>
                      <td className="py-1 tabular-nums">{d.pct}%</td>
                      <td className="py-1 tabular-nums">{d.total} שאלות</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">היסטוריית מבחנים</h2>
        {simulations.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">עוד לא עשית סימולציה.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="p-2 text-start">תאריך</th>
                  <th className="p-2 text-start">ציון מוערך</th>
                  {TOPIC_ORDER.map((t) => (
                    <th key={t} className="p-2 text-start">
                      {TOPICS[t].short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...simulations].reverse().map((sim) => (
                  <tr key={sim.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="p-2">{new Date(sim.at).toLocaleDateString('he-IL')}</td>
                    <td className="p-2 font-extrabold tabular-nums">{sim.estimated}</td>
                    {TOPIC_ORDER.map((t) => (
                      <td key={t} className="p-2 tabular-nums">
                        {sim.sections.find((s) => s.topic === t)?.score ?? '–'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">הציונים הם הערכה בלבד ולא ציון רשמי.</p>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-bold">
          תגים ({Object.keys(badges).length}/{BADGES.length})
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BADGES.map((b) => {
            const earned = badges[b.id];
            return (
              <li
                key={b.id}
                className={`rounded-xl border p-3 text-center ${earned ? 'border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10' : 'border-slate-200 opacity-50 grayscale dark:border-slate-800'}`}
              >
                <div className="text-3xl" aria-hidden>
                  {b.emoji}
                </div>
                <div className="text-sm font-bold">{b.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{b.description}</div>
                {!earned && <span className="sr-only">(עוד לא הושג)</span>}
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex justify-end">
        {confirmReset ? (
          <div className="flex items-center gap-2 text-sm">
            <span>למחוק את כל ההתקדמות? אי אפשר לבטל.</span>
            <Button
              className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-500"
              onClick={() => {
                resetAll();
                setConfirmReset(false);
              }}
            >
              כן, למחוק
            </Button>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              ביטול
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmReset(true)}>
            איפוס נתונים
          </Button>
        )}
      </div>
    </div>
  );
}
