import { useState } from 'react';

export interface Point {
  label: string;
  value: number;
  detail?: string;
}

/**
 * גרף קו של סדרה אחת (אחוז הצלחה לאורך זמן), עם tooltip במעבר עכבר / נגיעה.
 * ציר X רץ מימין לשמאל (RTL): הנקודה הראשונה בצד ימין.
 */
export function LineChart({ points, height = 200 }: { points: Point[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const pad = { top: 16, bottom: 28, side: 36 };
  const innerW = W - pad.side * 2;
  const innerH = H - pad.top - pad.bottom;
  const x = (i: number) => W - pad.side - (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / 100) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="גרף אחוז הצלחה לאורך זמן">
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={pad.side} x2={W - pad.side} y1={y(g)} y2={y(g)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" />
            <text x={W - pad.side + 6} y={y(g) + 4} className="fill-slate-400 text-[11px]" textAnchor="start">
              {g}%
            </text>
          </g>
        ))}
        <path d={path} fill="none" className="stroke-violet-500" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 6 : 4} className="fill-violet-500 stroke-white dark:stroke-slate-900" strokeWidth="2" />
            {/* אזור פגיעה רחב מהנקודה */}
            <rect
              x={x(i) - innerW / Math.max(2, points.length) / 2}
              y={pad.top}
              width={innerW / Math.max(2, points.length)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(i)}
            />
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="3 3" />}
        {points.length > 0 && (
          <>
            <text x={x(0)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">
              {points[0].label}
            </text>
            {points.length > 1 && (
              <text x={x(points.length - 1)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">
                {points[points.length - 1].label}
              </text>
            )}
          </>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow dark:bg-slate-100 dark:text-slate-900"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          {h.label}: {h.value}%{h.detail ? ` · ${h.detail}` : ''}
        </div>
      )}
    </div>
  );
}

/** פסים אופקיים של סדרה אחת, עם הערך כתוב ליד כל פס */
export function BarList({ rows }: { rows: { label: string; value: number | null; detail: string }[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="space-y-1" title={r.detail}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">{r.label}</span>
            <span className="text-slate-500 tabular-nums dark:text-slate-400">
              {r.value === null ? 'אין נתונים' : `${r.value}%`} <span className="text-xs">· {r.detail}</span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-violet-500 transition-[width] duration-700" style={{ width: `${r.value ?? 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
