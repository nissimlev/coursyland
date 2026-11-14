import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { ArrowLeftIcon } from '../components/ui/Icons';
import { levelProgress, liveStreak } from '../engine/gamification';
import { recommend, recommendationTitle } from '../engine/stats';
import { percent } from '../lib/format';
import { isTopicAvailable } from '../questions/bank';
import { DIFFICULTY_NAMES, TOPIC_ORDER, TOPICS } from '../questions/topics';
import { useProgress } from '../store/progress';

function LinkCard({ to, emoji, gradient, title, text, badge }: { to: string; emoji: string; gradient: string; title: string; text: string; badge?: string }) {
  return (
    <Link to={to} className="group rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500">
      <Card className="flex h-full items-center gap-4 transition group-hover:-translate-y-0.5 group-hover:border-violet-300 group-hover:shadow-md dark:group-hover:border-violet-500/60">
        <span className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-3xl ${gradient}`} aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            {title}
            {badge && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">{badge}</span>}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{text}</p>
        </div>
        <ArrowLeftIcon className="shrink-0 text-violet-500 transition-transform group-hover:-translate-x-1" />
      </Card>
    </Link>
  );
}

export function HomePage() {
  const attempts = useProgress((s) => s.attempts);
  const mistakesCount = useProgress((s) => Object.keys(s.mistakes).length);
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const correct = attempts.filter((a) => a.result === 'correct').length;
  const lp = levelProgress(xp);
  const days = liveStreak(streak, Date.now());
  const rec = recommend(attempts);

  return (
    <div className="space-y-8">
      <section className="animate-rise overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-violet-600 to-fuchsia-500 p-6 text-white shadow-lg shadow-violet-600/20 sm:p-10 dark:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">מתאמנים לדפ״ר</h1>
            <p className="mt-2 max-w-xl text-lg text-violet-100">תרגול קצר וממוקד בכל יום, עם הסבר מפורט לכל שאלה.</p>
          </div>
          <Link to="/progress" className="rounded-2xl bg-white/15 px-4 py-3 text-center backdrop-blur transition hover:bg-white/25">
            <div className="text-xs font-semibold text-violet-100">רמה {lp.level}</div>
            <div className="text-lg font-extrabold">{lp.rank}</div>
            <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${lp.pct}%` }} />
            </div>
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
          <span className="rounded-full bg-white/15 px-3 py-1.5">🔥 {days} ימים ברצף</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5">שאלות שנענו: {attempts.length}</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5">הצלחה: {percent(correct, attempts.length)}%</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5">{xp} XP</span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">מה לתרגל עכשיו?</h2>
        <LinkCard
          to={`/practice/${rec.topic}`}
          emoji="💡"
          gradient="from-amber-400 to-orange-400"
          title={recommendationTitle(rec, TOPICS[rec.topic].name, DIFFICULTY_NAMES[rec.difficulty])}
          text={rec.reason}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">תרגול לפי נושא</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {TOPIC_ORDER.filter(isTopicAvailable).map((id) => {
            const t = TOPICS[id];
            return <LinkCard key={id} to={`/practice/${id}`} emoji={t.emoji} gradient={t.gradient} title={t.name} text={t.description} />;
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">עוד דרכים להתאמן</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <LinkCard to="/practice/mixed" emoji="🎲" gradient="from-fuchsia-500 to-rose-400" title="תרגול מעורב" text="שאלות מכל הנושאים ביחד" />
          <LinkCard to="/simulation" emoji="📝" gradient="from-indigo-600 to-violet-500" title="סימולציה" text="מבחן מלא עם זמן לכל פרק" />
          <LinkCard
            to="/mistakes"
            emoji="🔁"
            gradient="from-orange-500 to-amber-400"
            title="מאגר טעויות"
            text="חזרה על שאלות שטעית בהן"
            badge={mistakesCount ? String(mistakesCount) : undefined}
          />
        </div>
      </section>
    </div>
  );
}
