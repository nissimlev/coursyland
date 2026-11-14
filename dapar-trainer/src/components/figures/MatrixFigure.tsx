import { useId } from 'react';
import type { ColorName, Figure, MatrixCell, ShapeName } from '../../questions/types';

/** צבעים בגוון בינוני שנראים טוב גם ברקע בהיר וגם בכהה */
export const SHAPE_COLORS: Record<ColorName, string> = {
  violet: '#8b5cf6',
  sky: '#0ea5e9',
  amber: '#f59e0b',
  rose: '#f43f5e',
  emerald: '#10b981',
};

function poly(points: [number, number][]) {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function regular(n: number, r: number, startDeg = -90): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
}

function star(r: number): [number, number][] {
  return Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = ((-90 + 36 * i) * Math.PI) / 180;
    return [rr * Math.cos(a), rr * Math.sin(a)];
  });
}

/** צורה ממורכזת ב-(0,0) ברדיוס r */
function ShapePath({ shape, r, fill, stroke }: { shape: ShapeName; r: number; fill: string; stroke: string }) {
  const common = { fill, stroke, strokeWidth: 2.6, strokeLinejoin: 'round' as const };
  switch (shape) {
    case 'circle':
      return <circle r={r * 0.92} {...common} />;
    case 'square':
      return <rect x={-r * 0.8} y={-r * 0.8} width={r * 1.6} height={r * 1.6} {...common} />;
    case 'triangle':
      return <polygon points={poly(regular(3, r))} {...common} />;
    case 'diamond':
      return <polygon points={poly([[0, -r], [r * 0.62, 0], [0, r], [-r * 0.62, 0]])} {...common} />;
    case 'hexagon':
      return <polygon points={poly(regular(6, r * 0.95, 0))} {...common} />;
    case 'pentagon':
      return <polygon points={poly(regular(5, r * 0.95))} {...common} />;
    case 'star':
      return <polygon points={poly(star(r))} {...common} />;
    case 'cross': {
      const a = r * 0.3;
      const b = r * 0.88;
      return <polygon points={poly([[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]])} {...common} />;
    }
    case 'arrow': {
      const w = r * 0.28;
      return <polygon points={poly([[0, -r], [r * 0.72, -r * 0.15], [w, -r * 0.15], [w, r], [-w, r], [-w, -r * 0.15], [-r * 0.72, -r * 0.15]])} {...common} />;
    }
    case 'flag':
      return (
        <g>
          <line x1={-r * 0.55} y1={-r} x2={-r * 0.55} y2={r} stroke={stroke} strokeWidth={3} strokeLinecap="round" />
          <polygon points={poly([[-r * 0.55, -r], [r * 0.85, -r * 0.55], [-r * 0.55, -r * 0.1]])} {...common} />
        </g>
      );
  }
}

const LAYOUT: Record<number, { pts: [number, number][]; r: number }> = {
  1: { pts: [[50, 44]], r: 25 },
  2: { pts: [[29, 44], [71, 44]], r: 16 },
  3: { pts: [[29, 28], [71, 28], [50, 62]], r: 14 },
  4: { pts: [[29, 26], [71, 26], [29, 62], [71, 62]], r: 14 },
};

export function CellSvg({ cell, className = '' }: { cell: MatrixCell; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const color = SHAPE_COLORS[cell.color];
  const patternId = `stripes-${uid}`;
  const fill = cell.fill === 'solid' ? color : cell.fill === 'striped' ? `url(#${patternId})` : 'transparent';
  const layout = LAYOUT[Math.min(4, Math.max(1, cell.count))];
  const dotsW = (cell.dots - 1) * 11;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <pattern id={patternId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="transparent" />
          <line x1="0" y1="0" x2="0" y2="5" stroke={color} strokeWidth="2.2" />
        </pattern>
      </defs>
      {layout.pts.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${cell.rotation})`}>
          <ShapePath shape={cell.shape} r={layout.r} fill={fill} stroke={color} />
        </g>
      ))}
      {Array.from({ length: cell.dots }, (_, i) => (
        <circle key={i} cx={50 - dotsW / 2 + i * 11} cy={89} r={3.6} className="fill-slate-700 dark:fill-slate-200" />
      ))}
    </svg>
  );
}

export function FigureView({ figure, alt }: { figure: Figure; alt: string }) {
  if (figure.type === 'cell') {
    return (
      <span role="img" aria-label={alt} className="block">
        <CellSvg cell={figure.cell} className="size-20 sm:size-24" />
      </span>
    );
  }
  return (
    <div role="img" aria-label={alt} className="mx-auto grid w-full max-w-sm grid-cols-3 gap-1.5 rounded-2xl bg-slate-200 p-1.5 dark:bg-slate-700">
      {figure.cells.map((cell, i) =>
        cell ? (
          <div key={i} className="aspect-square rounded-xl bg-white dark:bg-slate-900">
            <CellSvg cell={cell} className="size-full" />
          </div>
        ) : (
          <div
            key={i}
            className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-violet-400 bg-violet-50 text-4xl font-extrabold text-violet-500 dark:bg-violet-500/10"
          >
            ?
          </div>
        ),
      )}
    </div>
  );
}
