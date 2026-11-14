import type {
  AssignConstraint,
  Candidate,
  Choice,
  Cond,
  DigitOp,
  InstructionQuery,
  InstructionSpec,
  NumCond,
  NumOp,
} from '../types';

/**
 * פותר להבנת הוראות: מריץ את החוקים (בגרסה הפורמלית שלהם) על השאלה.
 * כל פונקציה זורקת שגיאה אם התשובה לא חד-משמעית.
 */

export type InstructionAnswer = { kind: 'text'; value: string } | { kind: 'number'; value: number } | { kind: 'index'; value: number };

// ---------- עזר ----------

export const HEB = 'אבגדהוזחטיכלמנסעפצקרשת';
const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
export const normHeb = (s: string) => [...s].map((ch) => FINALS[ch] ?? ch).join('');

function evalCond(c: Cond, attrs: Record<string, number | boolean | string>): boolean {
  if ('all' in c) return c.all.every((x) => evalCond(x, attrs));
  if ('any' in c) return c.any.some((x) => evalCond(x, attrs));
  if ('not' in c) return !evalCond(c.not, attrs);
  const v = attrs[c.attr];
  if (v === undefined) throw new Error(`missing attribute ${c.attr}`);
  switch (c.op) {
    case '=':
      return v === c.value;
    case '>=':
      return (v as number) >= (c.value as number);
    case '<=':
      return (v as number) <= (c.value as number);
    case '>':
      return (v as number) > (c.value as number);
    case '<':
      return (v as number) < (c.value as number);
  }
}

function digitOp(d: number, op: DigitOp): number {
  switch (op.op) {
    case 'add':
      return (d + op.v) % 10;
    case 'sub':
      return (((d - op.v) % 10) + 10) % 10;
    case 'mul':
      return (d * op.v) % 10;
    case 'comp9':
      return 9 - d;
  }
}

function encodeDigits(spec: Extract<InstructionSpec, { family: 'digit-code' }>, input: string): string {
  let digits = [...input].map((ch, i) => {
    let d = Number(ch);
    for (const op of spec.all ?? []) d = digitOp(d, op);
    const ops = i % 2 === 0 ? spec.odd : spec.even; // מקום 1 (אינדקס 0) הוא אי-זוגי
    for (const op of ops ?? []) d = digitOp(d, op);
    return d;
  });
  if (spec.reverse) digits = digits.reverse();
  if (spec.swapHalves) {
    const h = digits.length / 2;
    digits = [...digits.slice(h), ...digits.slice(0, h)];
  }
  return digits.join('');
}

function encodeLetters(spec: Extract<InstructionSpec, { family: 'letter-code' }>, input: string): string {
  let letters = [...normHeb(input)].map((ch) => {
    const i = HEB.indexOf(ch);
    if (i < 0) throw new Error(`not a Hebrew letter: ${ch}`);
    if (spec.atbash) return HEB[21 - i];
    return HEB[(i + (spec.shift ?? 0) + 22) % 22];
  });
  if (spec.swapEnds && letters.length > 1) {
    letters = [letters[letters.length - 1], ...letters.slice(1, -1), letters[0]];
  }
  return letters.join('');
}

function encode(spec: InstructionSpec, input: string): string {
  if (spec.family === 'digit-code') return encodeDigits(spec, input);
  if (spec.family === 'letter-code') return encodeLetters(spec, input);
  throw new Error('encode needs a code spec');
}

/** פענוח בכוח: עוברים על כל הקלטים האפשריים ומוודאים שיש בדיוק אחד */
function decode(spec: InstructionSpec, output: string): string {
  const out = normHeb(output);
  const n = [...out].length;
  const alphabet = spec.family === 'digit-code' ? '0123456789' : HEB;
  const found: string[] = [];
  const rec = (prefix: string) => {
    if ([...prefix].length === n) {
      if (encode(spec, prefix) === out) found.push(prefix);
      return;
    }
    for (const ch of alphabet) rec(prefix + ch);
  };
  if (alphabet.length ** n > 300_000) throw new Error('decode search too large');
  rec('');
  if (found.length !== 1) throw new Error(`decode is ambiguous (${found.length} inputs)`);
  return found[0];
}

function numCond(x: number, c: NumCond): boolean {
  if ('even' in c) return x % 2 === 0;
  if ('odd' in c) return x % 2 !== 0;
  if ('gt' in c) return x > c.gt;
  if ('lt' in c) return x < c.lt;
  return x % c.divisibleBy === 0;
}

function numOp(x: number, op: NumOp): number {
  switch (op.op) {
    case 'add':
      return x + op.v;
    case 'sub':
      return x - op.v;
    case 'mul':
      return x * op.v;
    case 'div':
      if (x % op.v !== 0) throw new Error(`non-integer division ${x}/${op.v}`);
      return x / op.v;
    case 'addUnits':
      return x + (Math.abs(x) % 10);
    case 'digitSum':
      return [...String(Math.abs(x))].reduce((s, d) => s + Number(d), 0);
    case 'reverseDigits':
      return Number([...String(x)].reverse().join(''));
  }
}

export function runProcedure(spec: Extract<InstructionSpec, { family: 'procedure' }>, input: number): number {
  let x = input;
  for (let r = 0; r < spec.repeat; r++) {
    for (const step of spec.steps) {
      const ops = !step.if || numCond(x, step.if) ? step.then : (step.else ?? []);
      for (const op of ops) x = numOp(x, op);
    }
  }
  return x;
}

const ROBOT_COLS = 'אבגדהוזח';
const ROBOT_MOVES: Record<string, [number, number]> = { מ: [0, 1], ט: [0, -1], י: [-1, 0], ש: [1, 0] };

/** טור 0 (א) הוא הימני; "שמאלה" מגדיל את מספר הטור. שורה 1 היא התחתונה. */
export function runRobot(spec: Extract<InstructionSpec, { family: 'robot' }>, start: string, commands: string): string {
  const parse = (label: string): [number, number] => [ROBOT_COLS.indexOf(label[0]), Number(label.slice(1))];
  let [c, r] = parse(start);
  const blocked = new Set(spec.obstacles);
  for (const cmd of commands.replace(/[\s,]/g, '')) {
    const mv = ROBOT_MOVES[cmd];
    if (!mv) throw new Error(`unknown robot command ${cmd}`);
    const nc = c + mv[0];
    const nr = r + mv[1];
    if (nc < 0 || nc >= spec.cols || nr < 1 || nr > spec.rows) continue; // יציאה מהלוח: נשאר במקום
    if (blocked.has(ROBOT_COLS[nc] + nr)) continue; // מכשול: נשאר במקום
    c = nc;
    r = nr;
  }
  return ROBOT_COLS[c] + r;
}

export function priorityOrder(spec: Extract<InstructionSpec, { family: 'priority' }>): string[] {
  const rows = Object.entries(spec.people).map(([name, attrs]) => {
    const all: Record<string, number | boolean | string> = { ...attrs, name };
    for (const [k, cond] of Object.entries(spec.derived ?? {})) all[k] = evalCond(cond, all);
    return all;
  });
  const cmp = (a: Record<string, unknown>, b: Record<string, unknown>) => {
    for (const k of spec.keys) {
      const va = a[k.attr];
      const vb = b[k.attr];
      let d: number;
      if (typeof va === 'string') d = va.localeCompare(vb as string, 'he');
      else d = Number(va) - Number(vb);
      if (d !== 0) return k.dir === 'asc' ? d : -d;
    }
    return 0;
  };
  const sorted = [...rows].sort(cmp);
  for (let i = 1; i < sorted.length; i++) {
    if (cmp(sorted[i - 1], sorted[i]) === 0) throw new Error(`priority tie between ${sorted[i - 1].name} and ${sorted[i].name}`);
  }
  return sorted.map((r) => r.name as string);
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]));
}

/** כל השיבוצים החוקיים: מפה אדם → מספר משבצת (מ-1) */
export function assignments(spec: Extract<InstructionSpec, { family: 'assignment' }>, extra: AssignConstraint[] = []): Record<string, number>[] {
  const constraints = [...spec.constraints, ...extra];
  const slots = spec.slots.map((_, i) => i + 1);
  return permutations(slots)
    .map((perm) => Object.fromEntries(spec.people.map((p, i) => [p, perm[i]])) as Record<string, number>)
    .filter((a) =>
      constraints.every((c) => {
        switch (c.type) {
          case 'is':
            return a[c.person] === c.slot;
          case 'not':
            return a[c.person] !== c.slot;
          case 'offset':
            return a[c.b] === a[c.a] + c.diff;
          case 'before':
            return a[c.a] < a[c.b];
        }
      }),
    );
}

function unique<T>(values: T[], what: string): T {
  const set = [...new Set(values)];
  if (set.length !== 1) throw new Error(`${what} is not unique: ${JSON.stringify(set)}`);
  return set[0];
}

function eligibleNames(spec: InstructionSpec, candidates: Candidate[]): string[] {
  if (spec.family !== 'eligibility') throw new Error('eligibility query on wrong spec');
  return candidates.filter((c) => evalCond(spec.rule, c.attrs)).map((c) => c.name);
}

// ---------- נקודת הכניסה ----------

export function solveInstruction(spec: InstructionSpec, q: InstructionQuery): InstructionAnswer {
  switch (q.type) {
    case 'encode':
      return { kind: 'text', value: encode(spec, q.input) };
    case 'decode':
      return { kind: 'text', value: decode(spec, q.output) };
    case 'eligible-one':
      return { kind: 'text', value: unique(eligibleNames(spec, q.candidates), 'eligible candidate') };
    case 'not-eligible-one': {
      const ok = eligibleNames(spec, q.candidates);
      return { kind: 'text', value: unique(q.candidates.map((c) => c.name).filter((n) => !ok.includes(n)), 'non-eligible candidate') };
    }
    case 'count-eligible':
      return { kind: 'number', value: eligibleNames(spec, q.candidates).length };
    case 'run':
      if (spec.family !== 'procedure') throw new Error('run needs a procedure');
      return { kind: 'number', value: runProcedure(spec, q.input) };
    case 'find-input': {
      if (spec.family !== 'procedure') throw new Error('find-input needs a procedure');
      const hits = q.inputs.map((x, i) => (runProcedure(spec, x) === q.output ? i : -1)).filter((i) => i >= 0);
      if (hits.length !== 1) throw new Error(`find-input: ${hits.length} inputs give ${q.output}`);
      return { kind: 'index', value: hits[0] };
    }
    case 'robot-final':
      if (spec.family !== 'robot') throw new Error('robot query on wrong spec');
      return { kind: 'text', value: runRobot(spec, q.start, q.commands) };
    case 'position':
      if (spec.family !== 'priority') throw new Error('position needs priority');
      return { kind: 'text', value: priorityOrder(spec)[q.n - 1] };
    case 'position-of':
      if (spec.family !== 'priority') throw new Error('position-of needs priority');
      return { kind: 'number', value: priorityOrder(spec).indexOf(q.name) + 1 };
    case 'slot-of': {
      if (spec.family !== 'assignment') throw new Error('slot-of needs assignment');
      const sols = assignments(spec, q.extra);
      if (sols.length === 0) throw new Error('no valid assignment');
      return { kind: 'text', value: spec.slots[unique(sols.map((s) => s[q.person]), 'slot') - 1] };
    }
    case 'who-in': {
      if (spec.family !== 'assignment') throw new Error('who-in needs assignment');
      const sols = assignments(spec, q.extra);
      if (sols.length === 0) throw new Error('no valid assignment');
      return { kind: 'text', value: unique(sols.map((s) => Object.keys(s).find((p) => s[p] === q.slot)!), 'person') };
    }
    case 'must-be-true': {
      if (spec.family !== 'assignment') throw new Error('must-be-true needs assignment');
      const sols = assignments(spec);
      if (sols.length === 0) throw new Error('no valid assignment');
      const holds = q.options.map((o) => sols.every((s) => ('slot' in o ? s[o.person] === o.slot : s[o.person] !== o.notSlot)));
      const idx = holds.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
      if (idx.length !== 1) throw new Error(`must-be-true: ${idx.length} options always hold`);
      return { kind: 'index', value: idx[0] };
    }
  }
}

/** האם תשובה (מספר i בסדר a–d) מתאימה לתשובת הפותר */
export function matchAnswer(ans: InstructionAnswer, choice: Choice, index: number): boolean {
  const text = choice.content.kind === 'text' ? choice.content.text.trim() : '';
  if (ans.kind === 'index') return ans.value === index;
  if (ans.kind === 'number') {
    const v = choice.value ?? Number((/-?\d+/.exec(text) ?? [''])[0]);
    return v === ans.value;
  }
  // טקסט: התאמה מדויקת, או שהתשובה כתובה כ"יום רביעי"/"פנייה א" שמסתיימת בערך
  return normHeb(text) === normHeb(ans.value) || normHeb(text).endsWith(' ' + normHeb(ans.value));
}
