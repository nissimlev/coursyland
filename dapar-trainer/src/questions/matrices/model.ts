import type { ColorName, FillName, MatrixCell, ShapeName } from '../types';

export type Attr = keyof MatrixCell;
export const ATTRS: Attr[] = ['shape', 'count', 'fill', 'color', 'rotation', 'dots'];
export const NUMERIC_ATTRS: Attr[] = ['count', 'rotation', 'dots'];

type V = string | number;

/** חוקיות של תכונה אחת לאורך המטריצה (שורה = row, טור = col; טור 0 הוא הימני) */
export type AttrRule =
  | { type: 'const'; value: V }
  | { type: 'rowConst'; values: V[] } // ערך קבוע בכל שורה
  | { type: 'colConst'; values: V[] } // ערך קבוע בכל טור
  | { type: 'latin'; values: V[]; shift: 1 | 2 } // כל שורה מכילה את שלושת הערכים
  | { type: 'progression'; start: number; step: number; rowStep: number } // start + step·col + rowStep·row
  | { type: 'sum'; firsts: [number, number][] }; // בכל שורה: טור 2 = טור 0 + טור 1

export type MatrixSpec = Record<Attr, AttrRule>;

export function attrValue(rule: AttrRule, attr: Attr, row: number, col: number): V {
  switch (rule.type) {
    case 'const':
      return rule.value;
    case 'rowConst':
      return rule.values[row];
    case 'colConst':
      return rule.values[col];
    case 'latin':
      return rule.values[(col + rule.shift * row) % 3];
    case 'progression': {
      const v = rule.start + rule.step * col + rule.rowStep * row;
      return attr === 'rotation' ? ((v % 360) + 360) % 360 : v;
    }
    case 'sum': {
      const [a, b] = rule.firsts[row];
      return col === 0 ? a : col === 1 ? b : a + b;
    }
  }
}

export function cellAt(spec: MatrixSpec, row: number, col: number): MatrixCell {
  const v = (a: Attr) => attrValue(spec[a], a, row, col);
  return {
    shape: v('shape') as ShapeName,
    count: v('count') as number,
    fill: v('fill') as FillName,
    color: v('color') as ColorName,
    rotation: v('rotation') as number,
    dots: v('dots') as number,
  };
}

/** סדר הסימטריה הסיבובית של כל צורה: סיבוב בכפולה של הערך הזה לא משנה את המראה */
export const ROTATION_PERIOD: Record<ShapeName, number> = {
  circle: 1,
  square: 90,
  cross: 90,
  diamond: 180,
  hexagon: 60,
  pentagon: 72,
  star: 72,
  triangle: 120,
  arrow: 360,
  flag: 360,
};

export function normRotation(shape: ShapeName, rotation: number): number {
  const p = ROTATION_PERIOD[shape];
  return p === 1 ? 0 : ((rotation % p) + p) % p;
}

/** מפתח שמזהה איך המשבצת נראית (שתי משבצות עם אותו מפתח נראות זהות) */
export function cellKey(c: MatrixCell): string {
  return `${c.shape}|${c.count}|${c.fill}|${c.color}|${normRotation(c.shape, c.rotation)}|${c.dots}`;
}

// ---------- שמות בעברית ----------

export const SHAPE_NAMES: Record<ShapeName, [string, string]> = {
  circle: ['עיגול', 'עיגולים'],
  square: ['ריבוע', 'ריבועים'],
  triangle: ['משולש', 'משולשים'],
  diamond: ['מעוין', 'מעוינים'],
  hexagon: ['משושה', 'משושים'],
  pentagon: ['מחומש', 'מחומשים'],
  star: ['כוכב', 'כוכבים'],
  cross: ['צלב', 'צלבים'],
  arrow: ['חץ', 'חצים'],
  flag: ['דגל', 'דגלים'],
};
export const FILL_NAMES: Record<FillName, [string, string]> = {
  none: ['ריק', 'ריקים'],
  striped: ['מפוספס', 'מפוספסים'],
  solid: ['מלא', 'מלאים'],
};
export const COLOR_NAMES: Record<ColorName, [string, string]> = {
  violet: ['סגול', 'סגולים'],
  sky: ['כחול', 'כחולים'],
  amber: ['כתום', 'כתומים'],
  rose: ['אדום', 'אדומים'],
  emerald: ['ירוק', 'ירוקים'],
};

const ROT_WORDS = (r: number) => (r === 0 ? '' : `, מסובב ב-${r}° עם כיוון השעון`);

export function describeCell(c: MatrixCell): string {
  const plural = c.count > 1 ? 1 : 0;
  const base =
    c.count === 1
      ? `${SHAPE_NAMES[c.shape][0]} ${COLOR_NAMES[c.color][0]} ${FILL_NAMES[c.fill][0]}`
      : `${c.count} ${SHAPE_NAMES[c.shape][1]} ${COLOR_NAMES[c.color][1]} ${FILL_NAMES[c.fill][1]}`;
  const rot = ROTATION_PERIOD[c.shape] === 1 ? '' : ROT_WORDS(normRotation(c.shape, c.rotation)).replace('מסובב', plural ? 'מסובבים' : 'מסובב');
  const dots = c.dots === 0 ? ', בלי נקודות' : c.dots === 1 ? ', עם נקודה אחת' : `, עם ${c.dots} נקודות`;
  return base + rot + dots;
}
