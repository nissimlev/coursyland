import { rankName, type Reward } from '../engine/gamification';

/** תצוגת התגמולים בסוף תרגול: XP, עליית רמה ותגים חדשים */
export function RewardPanel({ reward }: { reward: Reward }) {
  if (reward.xp === 0 && reward.newBadges.length === 0) return null;
  const levelUp = reward.levelAfter > reward.levelBefore;
  return (
    <div className="animate-rise space-y-3 rounded-2xl border border-violet-200 bg-gradient-to-l from-violet-50 to-fuchsia-50 p-5 dark:border-violet-500/30 dark:from-violet-500/10 dark:to-fuchsia-500/10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="animate-pop rounded-full bg-violet-600 px-4 py-1.5 text-lg font-extrabold text-white dark:bg-violet-500">+{reward.xp} XP</span>
        <span className="text-sm text-slate-600 dark:text-slate-300">{reward.breakdown.map((b) => `${b.label} ${b.xp}`).join(' · ')}</span>
        {reward.streak > 1 && <span className="text-sm font-bold text-orange-600 dark:text-orange-400">🔥 {reward.streak} ימים ברצף</span>}
      </div>
      {levelUp && (
        <p className="animate-pop text-lg font-extrabold text-violet-800 dark:text-violet-200">
          🎉 עלית לרמה {reward.levelAfter}: {rankName(reward.levelAfter)}!
        </p>
      )}
      {reward.newBadges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {reward.newBadges.map((b) => (
            <span
              key={b.id}
              className="animate-pop inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold shadow-sm dark:bg-slate-800"
              title={b.description}
            >
              <span className="text-xl" aria-hidden>
                {b.emoji}
              </span>
              תג חדש: {b.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
