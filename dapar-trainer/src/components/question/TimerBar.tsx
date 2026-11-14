import { useEffect, useRef, useState } from 'react';
import { ClockIcon } from '../ui/Icons';

/**
 * פס זמן שמתרוקן. משנה צבע לכתום ואז לאדום כשהזמן עומד להיגמר.
 * צריך לתת key חדש לכל שאלה כדי לאפס אותו.
 */
export function TimerBar({ durationSec, running, onExpire }: { durationSec: number; running: boolean; onExpire: () => void }) {
  const [remainingMs, setRemainingMs] = useState(durationSec * 1000);
  const remainingRef = useRef(remainingMs);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  // מבוסס שעון אמיתי (deadline), כך שהזמן ממשיך לרוץ נכון גם כשהלשונית ברקע
  useEffect(() => {
    if (!running) return;
    const deadline = Date.now() + remainingRef.current;
    let done = false;
    const tick = () => {
      if (done) return;
      remainingRef.current = Math.max(0, deadline - Date.now());
      setRemainingMs(remainingRef.current);
      if (remainingRef.current <= 0) {
        done = true;
        expireRef.current();
      }
    };
    const id = window.setInterval(tick, 100);
    return () => {
      done = true;
      window.clearInterval(id);
    };
  }, [running]);

  const frac = remainingMs / (durationSec * 1000);
  const color = frac > 0.5 ? 'bg-emerald-500' : frac > 0.2 ? 'bg-amber-500' : 'bg-rose-500';
  const text = frac > 0.5 ? 'text-slate-500 dark:text-slate-400' : frac > 0.2 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  const secs = Math.ceil(remainingMs / 1000);

  return (
    <div className="flex items-center gap-3" role="timer" aria-label={`נשארו ${secs} שניות`}>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-100 ease-linear ${color} ${frac <= 0.2 && running ? 'animate-pulse-soft' : ''}`}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
      <span className={`flex w-14 items-center justify-end gap-1 text-sm font-bold tabular-nums ${text}`}>
        <ClockIcon width={16} height={16} />
        {secs}
      </span>
    </div>
  );
}
