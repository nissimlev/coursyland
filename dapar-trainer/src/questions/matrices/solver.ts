import type { MatrixCell } from '../types';
import { ATTRS, cellKey, NUMERIC_ATTRS, type Attr } from './model';

type V = string | number;

export interface MatrixSolution {
  /** התשובה, אם החוקיות חד-משמעית */
  cell: MatrixCell | null;
  /** לכל תכונה: אילו חוקים התאימו ואיזה ערך כל אחד חוזה */
  reasons: Partial<Record<Attr, { hypotheses: string[]; predictions: V[] }>>;
  ambiguousAttrs: Attr[];
  unsolvedAttrs: Attr[];
}

const eq = (attr: Attr, a: V, b: V) => (attr === 'rotation' ? (((Number(a) - Number(b)) % 360) + 360) % 360 === 0 : a === b);
const norm = (attr: Attr, v: number) => (attr === 'rotation' ? ((v % 360) + 360) % 360 : v);

/**
 * פותר עצמאי: לא מכיר את החוקיות שבה נבנתה המטריצה.
 * לכל תכונה הוא בודק אוסף השערות (קבוע, קבוע בשורה/בטור, ריבוע לטיני, סדרה חשבונית, סכום)
 * ושומר רק את אלה שמתאימות ל-8 המשבצות הידועות. אם כל ההשערות המתאימות חוזות אותו ערך,
 * התכונה חד-משמעית.
 */
export function solveMatrix(cells: (MatrixCell | null)[]): MatrixSolution {
  if (cells.length !== 9 || cells[8] !== null || cells.slice(0, 8).some((c) => c === null)) {
    throw new Error('matrix must have 8 known cells and the last one missing');
  }
  const grid = (attr: Attr, r: number, c: number): V => (cells[r * 3 + c] as MatrixCell)[attr];

  const reasons: MatrixSolution['reasons'] = {};
  const ambiguousAttrs: Attr[] = [];
  const unsolvedAttrs: Attr[] = [];
  const answer: Partial<Record<Attr, V>> = {};

  for (const attr of ATTRS) {
    const g = (r: number, c: number) => grid(attr, r, c);
    const known = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => g(Math.floor(i / 3), i % 3));
    const hyps: { name: string; value: V }[] = [];

    // קבוע
    if (known.every((v) => eq(attr, v, known[0]))) hyps.push({ name: 'const', value: known[0] });
    // קבוע בכל שורה
    if ([0, 1].every((r) => eq(attr, g(r, 0), g(r, 1)) && eq(attr, g(r, 1), g(r, 2))) && eq(attr, g(2, 0), g(2, 1)))
      hyps.push({ name: 'rowConst', value: g(2, 0) });
    // קבוע בכל טור
    if ([0, 1, 2].every((c) => eq(attr, g(0, c), g(1, c))) && eq(attr, g(0, 0), g(2, 0)) && eq(attr, g(0, 1), g(2, 1)))
      hyps.push({ name: 'colConst', value: g(0, 2) });
    // ריבוע לטיני לפי שורות: כל שורה מכילה את אותם שלושה ערכים שונים
    const rowSet = (r: number) => [g(r, 0), g(r, 1), g(r, 2)];
    const distinct3 = (vals: V[]) => new Set(vals.map(String)).size === 3;
    const sameSet = (a: V[], b: V[]) => a.every((x) => b.some((y) => eq(attr, x, y)));
    if (distinct3(rowSet(0)) && distinct3(rowSet(1)) && sameSet(rowSet(0), rowSet(1)) && !eq(attr, g(2, 0), g(2, 1))) {
      const missing = rowSet(0).filter((x) => !eq(attr, x, g(2, 0)) && !eq(attr, x, g(2, 1)));
      if (missing.length === 1) hyps.push({ name: 'latinRows', value: missing[0] });
    }
    // ריבוע לטיני לפי טורים
    const colSet = (c: number) => [g(0, c), g(1, c), g(2, c)];
    if (distinct3(colSet(0)) && distinct3(colSet(1)) && sameSet(colSet(0), colSet(1)) && !eq(attr, g(0, 2), g(1, 2))) {
      const missing = colSet(0).filter((x) => !eq(attr, x, g(0, 2)) && !eq(attr, x, g(1, 2)));
      if (missing.length === 1) hyps.push({ name: 'latinCols', value: missing[0] });
    }

    if (NUMERIC_ATTRS.includes(attr)) {
      const n = (r: number, c: number) => Number(g(r, c));
      const d = (a: number, b: number) => norm(attr, b - a);
      // סדרה חשבונית לאורך כל שורה, עם אותו הפרש בכל השורות
      const step = d(n(0, 0), n(0, 1));
      if (
        [0, 1].every((r) => d(n(r, 0), n(r, 1)) === step && d(n(r, 1), n(r, 2)) === step) &&
        d(n(2, 0), n(2, 1)) === step
      )
        hyps.push({ name: 'rowProgression', value: norm(attr, n(2, 1) + step) });
      // סדרה חשבונית לאורך כל טור
      const cstep = d(n(0, 0), n(1, 0));
      if (
        [0, 1].every((c) => d(n(0, c), n(1, c)) === cstep && d(n(1, c), n(2, c)) === cstep) &&
        d(n(0, 2), n(1, 2)) === cstep
      )
        hyps.push({ name: 'colProgression', value: norm(attr, n(1, 2) + cstep) });
      // סכום: בכל שורה הטור השלישי = סכום שני הראשונים
      if (attr !== 'rotation' && [0, 1].every((r) => n(r, 0) + n(r, 1) === n(r, 2)))
        hyps.push({ name: 'rowSum', value: n(2, 0) + n(2, 1) });
    }

    const predictions: V[] = [];
    for (const h of hyps) if (!predictions.some((p) => eq(attr, p, h.value))) predictions.push(h.value);
    reasons[attr] = { hypotheses: hyps.map((h) => h.name), predictions };
    if (predictions.length === 1) answer[attr] = predictions[0];
    else if (predictions.length === 0) unsolvedAttrs.push(attr);
    else ambiguousAttrs.push(attr);
  }

  const solved = ambiguousAttrs.length === 0 && unsolvedAttrs.length === 0;
  return { cell: solved ? (answer as unknown as MatrixCell) : null, reasons, ambiguousAttrs, unsolvedAttrs };
}

export function sameCell(a: MatrixCell, b: MatrixCell): boolean {
  return cellKey(a) === cellKey(b);
}
