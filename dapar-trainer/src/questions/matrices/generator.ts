import { createRng, type Rng } from '../../engine/rng';
import { CHOICE_IDS, type ColorName, type Difficulty, type FillName, type MatricesSubtopic, type MatrixCell, type Question, type ShapeName } from '../types';
import {
  ATTRS,
  cellAt,
  cellKey,
  COLOR_NAMES,
  describeCell,
  FILL_NAMES,
  SHAPE_NAMES,
  type Attr,
  type AttrRule,
  type MatrixSpec,
} from './model';
import { solveMatrix } from './solver';

const SYM_SHAPES: ShapeName[] = ['circle', 'square', 'diamond', 'hexagon', 'pentagon', 'star', 'cross', 'triangle'];
const ROT_SHAPES: ShapeName[] = ['arrow', 'flag', 'triangle'];
const FILLS: FillName[] = ['none', 'striped', 'solid'];
const COLORS: ColorName[] = ['violet', 'sky', 'amber', 'rose', 'emerald'];

type VaryKind = 'count' | 'rotation' | 'dots' | 'fill' | 'color' | 'shape';

/** בונה חוק לתכונה משתנה */
function varyRule(rng: Rng, kind: VaryKind, difficulty: Difficulty): AttrRule {
  const hard = difficulty === 'hard';
  const pick3 = <T,>(list: T[]) => rng.shuffle(list).slice(0, 3);
  switch (kind) {
    case 'count': {
      if (hard && rng.chance(0.5)) {
        const pairs: [number, number][] = [[1, 1], [1, 2], [2, 1], [2, 2], [1, 3], [3, 1]];
        return { type: 'sum', firsts: rng.shuffle(pairs).slice(0, 3) };
      }
      if (difficulty !== 'easy' && rng.chance(0.4)) return { type: 'latin', values: [1, 2, 3], shift: rng.pick([1, 2] as const) };
      // 1–4 צורות בלבד, ולכן אין כאן הזזה בין שורות
      return rng.chance(0.5) ? { type: 'progression', start: 1, step: 1, rowStep: 0 } : { type: 'progression', start: 3, step: -1, rowStep: 0 };
    }
    case 'dots': {
      if (hard && rng.chance(0.5)) {
        const pairs: [number, number][] = [[0, 1], [1, 1], [1, 2], [2, 1], [2, 2], [1, 3], [3, 2], [2, 3]];
        return { type: 'sum', firsts: rng.shuffle(pairs).slice(0, 3) };
      }
      const rowStep = difficulty === 'easy' ? 0 : rng.pick([1, 0]);
      return { type: 'progression', start: rng.int(0, 1), step: 1, rowStep };
    }
    case 'rotation': {
      const step = difficulty === 'easy' ? 90 : rng.pick([45, 90]) * (rng.chance(0.3) ? -1 : 1);
      const rowStep = difficulty === 'easy' ? 0 : hard ? rng.pick([90, 45, 180]) : rng.pick([0, 90]);
      return { type: 'progression', start: rng.pick([0, 90, 180, 270]), step, rowStep };
    }
    case 'fill':
      return rng.chance(difficulty === 'easy' ? 0.3 : 0.15)
        ? { type: 'rowConst', values: pick3(FILLS) }
        : { type: 'latin', values: pick3(FILLS), shift: hard ? rng.pick([1, 2] as const) : 1 };
    case 'color':
      return rng.chance(difficulty === 'easy' ? 0.3 : 0.15)
        ? { type: 'colConst', values: pick3(COLORS) }
        : { type: 'latin', values: pick3(COLORS), shift: hard ? rng.pick([1, 2] as const) : 1 };
    case 'shape':
      return { type: 'latin', values: pick3(SYM_SHAPES), shift: rng.pick([1, 2] as const) };
  }
}

const EASY_KINDS: Record<Exclude<MatricesSubtopic, 'combined'>, VaryKind[]> = {
  rotation: ['rotation'],
  'add-element': ['dots'],
  count: ['count'],
  'fill-color': ['fill', 'color'],
};

function planSpec(rng: Rng, difficulty: Difficulty, subtopic?: MatricesSubtopic): { spec: MatrixSpec; subtopic: MatricesSubtopic; varying: Attr[] } {
  const nVary = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  let kinds: VaryKind[];
  let sub: MatricesSubtopic;
  if (nVary === 1) {
    sub = subtopic && subtopic !== 'combined' ? subtopic : rng.pick(Object.keys(EASY_KINDS) as Exclude<MatricesSubtopic, 'combined'>[]);
    kinds = [rng.pick(EASY_KINDS[sub as Exclude<MatricesSubtopic, 'combined'>])];
  } else {
    sub = 'combined';
    // סיבוב וצורה משתנה לא הולכים יחד (צורה סימטרית לא מראה סיבוב)
    const pool: VaryKind[] = rng.shuffle(['count', 'rotation', 'dots', 'fill', 'color', 'shape']);
    kinds = [];
    for (const k of pool) {
      if (kinds.length >= nVary) break;
      if (k === 'shape' && kinds.includes('rotation')) continue;
      if (k === 'rotation' && kinds.includes('shape')) continue;
      if (k === 'count' && kinds.includes('dots') && difficulty === 'medium') continue;
      kinds.push(k);
    }
  }

  const rotates = kinds.includes('rotation');
  const spec: MatrixSpec = {
    shape: { type: 'const', value: rotates ? rng.pick(ROT_SHAPES) : rng.pick(SYM_SHAPES) },
    count: { type: 'const', value: rotates ? 1 : rng.pick([1, 1, 2]) },
    fill: { type: 'const', value: rng.pick(FILLS) },
    color: { type: 'const', value: rng.pick(COLORS) },
    rotation: { type: 'const', value: 0 },
    dots: { type: 'const', value: 0 },
  };
  for (const k of kinds) spec[k as Attr] = varyRule(rng, k, difficulty);
  return { spec, subtopic: sub, varying: kinds as Attr[] };
}

function valid(c: MatrixCell): boolean {
  return c.count >= 1 && c.count <= 4 && c.dots >= 0 && c.dots <= 5;
}

/** מסיחים: משנים תכונה אחת (ולפעמים שתיים) בתשובה הנכונה */
function buildDistractors(rng: Rng, answer: MatrixCell, grid: MatrixCell[], varying: Attr[], difficulty: Difficulty): MatrixCell[] {
  const candidates: MatrixCell[] = [];
  const alt = (attr: Attr): (string | number)[] => {
    const seen = grid.map((c) => c[attr]).filter((v) => v !== answer[attr]);
    const extra: (string | number)[] = [];
    if (attr === 'count') extra.push(answer.count + 1, answer.count - 1);
    if (attr === 'dots') extra.push(answer.dots + 1, answer.dots - 1);
    if (attr === 'rotation') extra.push(answer.rotation + 90, answer.rotation + 180, answer.rotation + 45);
    if (attr === 'fill') extra.push(...FILLS);
    if (attr === 'color') extra.push(...COLORS.slice(0, 3));
    if (attr === 'shape') extra.push(...SYM_SHAPES.slice(0, 3));
    return rng.shuffle([...new Set([...seen, ...extra])]);
  };
  const change = (base: MatrixCell, attr: Attr, v: string | number): MatrixCell => {
    const c = { ...base, [attr]: attr === 'rotation' ? ((Number(v) % 360) + 360) % 360 : v } as MatrixCell;
    return c;
  };

  for (const attr of rng.shuffle(varying)) for (const v of alt(attr).slice(0, 2)) candidates.push(change(answer, attr, v));
  if (difficulty === 'hard' && varying.length >= 2) {
    const [a1, a2] = varying;
    candidates.push(change(change(answer, a1, alt(a1)[0]), a2, alt(a2)[0]));
  }
  // תכונה קבועה אחת (פחות מפתה, משמשת השלמה)
  const constAttr = rng.pick(ATTRS.filter((a) => !varying.includes(a) && a !== 'rotation'));
  for (const v of alt(constAttr).slice(0, 2)) candidates.push(change(answer, constAttr, v));

  const keys = new Set([cellKey(answer)]);
  const out: MatrixCell[] = [];
  // קודם מסיחים שמשנים תכונה משתנה, כי הם המבחן האמיתי
  const tryAdd = (c: MatrixCell) => {
    if (out.length >= 3 || !valid(c) || keys.has(cellKey(c))) return;
    keys.add(cellKey(c));
    out.push(c);
  };
  candidates.forEach(tryAdd);
  // גיבוי: כל שינוי חוקי של תכונה אחת
  for (const attr of [...varying, ...ATTRS.filter((a) => !varying.includes(a) && a !== 'rotation')]) {
    for (const v of alt(attr)) tryAdd(change(answer, attr, v));
  }
  if (out.length < 3) throw new Error('not enough distractors');
  return out;
}

// ---------- הסבר ----------

const attrWord: Record<Attr, string> = {
  shape: 'הצורה',
  count: 'מספר הצורות',
  fill: 'המילוי',
  color: 'הצבע',
  rotation: 'הכיוון',
  dots: 'מספר הנקודות',
};

function valueName(attr: Attr, v: string | number): string {
  if (attr === 'shape') return SHAPE_NAMES[v as ShapeName][0];
  if (attr === 'fill') return FILL_NAMES[v as FillName][0];
  if (attr === 'color') return COLOR_NAMES[v as ColorName][0];
  if (attr === 'rotation') return `${v}°`;
  return String(v);
}

function explainRule(attr: Attr, rule: AttrRule, answer: MatrixCell): string {
  const w = attrWord[attr];
  const fem = attr === 'shape';
  const constWord = fem ? 'קבועה' : 'קבוע';
  const pron = fem ? 'היא' : 'הוא';
  switch (rule.type) {
    case 'const':
      return '';
    case 'rowConst':
      return `${w} ${constWord} בכל שורה, ובשורה התחתונה ${pron} ${valueName(attr, rule.values[2])}.`;
    case 'colConst':
      return `${w} ${constWord} בכל טור (מלמעלה למטה), ובטור השמאלי ${pron} ${valueName(attr, rule.values[2])}.`;
    case 'latin':
      return `בכל שורה מופיעים שלושה ערכים של ${w}: ${rule.values.map((v) => valueName(attr, v)).join(', ')}, כל אחד פעם אחת. בשורה התחתונה חסר ${valueName(attr, answer[attr])}.`;
    case 'progression': {
      if (attr === 'rotation') {
        const dir = rule.step > 0 ? 'עם כיוון השעון' : 'נגד כיוון השעון';
        const rowPart = rule.rowStep ? ` כל שורה מתחילה בכיוון שמסובב ב-${rule.rowStep}° ביחס לשורה שמעליה.` : '';
        return `בכל שורה, מימין לשמאל, הצורה מסתובבת ב-${Math.abs(rule.step)}° ${dir} בכל משבצת.${rowPart}`;
      }
      const verb = rule.step > 0 ? 'גדל' : 'קטן';
      const rowPart = rule.rowStep ? ` כל שורה מתחילה ב-${Math.abs(rule.rowStep)} ${rule.rowStep > 0 ? 'יותר' : 'פחות'} מהשורה שמעליה.` : '';
      return `בכל שורה, מימין לשמאל, ${w} ${verb} ב-${Math.abs(rule.step)} בכל משבצת.${rowPart}`;
    }
    case 'sum':
      return `בכל שורה, ${w} במשבצת השמאלית שווה לסכום של שתי המשבצות האחרות (למשל ${rule.firsts[0][0]} + ${rule.firsts[0][1]} = ${rule.firsts[0][0] + rule.firsts[0][1]}).`;
  }
}

export function explainMatrix(spec: MatrixSpec, answer: MatrixCell): string {
  const parts = ATTRS.map((a) => explainRule(a, spec[a], answer)).filter(Boolean);
  return `${parts.join(' ')} לכן במשבצת החסרה יש ${describeCell(answer)}.`;
}

// ---------- בניית שאלה ----------

export function buildMatrixQuestion(id: string, spec: MatrixSpec, subtopic: MatricesSubtopic, difficulty: Difficulty, seed: number): Question {
  const rng = createRng(seed);
  const grid: MatrixCell[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) grid.push(cellAt(spec, r, c));
  const answer = grid[8];
  const varying = ATTRS.filter((a) => spec[a].type !== 'const');
  const distractors = buildDistractors(rng, answer, grid, varying, difficulty);
  const cells = [...grid.slice(0, 8), null];
  return {
    id,
    topic: 'matrices',
    subtopic,
    difficulty,
    prompt: [
      { kind: 'text', text: 'איזו משבצת משלימה את המטריצה?' },
      { kind: 'figure', figure: { type: 'matrix', cells }, alt: 'מטריצה של 3 על 3 משבצות עם צורות. המשבצת השמאלית התחתונה חסרה.' },
    ],
    choices: [answer, ...distractors].map((cell, i) => ({
      id: CHOICE_IDS[i],
      content: { kind: 'figure', figure: { type: 'cell', cell }, alt: describeCell(cell) },
    })),
    correctChoiceId: 'a',
    explanation: explainMatrix(spec, answer),
    verify: { kind: 'matrix' },
  };
}

/** מחולל: מייצר מפרט חדש עד שהפותר מאשר שהוא חד-משמעי */
export function generateMatrixSpec(rng: Rng, difficulty: Difficulty, subtopic?: MatricesSubtopic): { spec: MatrixSpec; subtopic: MatricesSubtopic } {
  for (let i = 0; i < 200; i++) {
    const { spec, subtopic: sub } = planSpec(rng, difficulty, subtopic);
    const grid: MatrixCell[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) grid.push(cellAt(spec, r, c));
    if (!grid.every(valid)) continue;
    // כל המשבצות שונות זו מזו (אחרת קשה לראות את החוקיות)
    if (new Set(grid.map(cellKey)).size < (difficulty === 'easy' ? 3 : 6)) continue;
    const sol = solveMatrix([...grid.slice(0, 8), null]);
    if (!sol.cell || cellKey(sol.cell) !== cellKey(grid[8])) continue;
    return { spec, subtopic: sub };
  }
  throw new Error('matrix generator failed');
}
