import type { Rng } from '../../engine/rng';
import { formatSeries, seriesTerms } from '../solvers/series';
import type { Difficulty, SeriesOp, SeriesRule } from '../types';
import { numericChoices, text, type GeneratedDraft, type QuestionGenerator } from './common';

interface Plan {
  rule: SeriesRule;
  start: number[];
  shown: number;
}

const SUP: Record<number, string> = { 2: '²', 3: '³' };
const opSym = (op: SeriesOp['op']) => ({ '+': '+', '-': '−', '*': '×', '/': '÷' })[op];
const opWords = (o: SeriesOp) =>
  ({ '+': `מוסיפים ${o.v}`, '-': `מחסירים ${o.v}`, '*': `כופלים ב-${o.v}`, '/': `מחלקים ב-${o.v}` })[o.op];

const PLANS: Record<Difficulty, ((rng: Rng) => Plan)[]> = {
  easy: [
    (rng) => {
      const d = rng.int(2, 9) * (rng.chance(0.35) ? -1 : 1);
      return { rule: { type: 'add', d }, start: [d < 0 ? rng.int(45, 95) : rng.int(1, 30)], shown: 4 };
    },
    (rng) => ({ rule: { type: 'mul', r: rng.pick([2, 3]) }, start: [rng.int(1, 6)], shown: 4 }),
    (rng) => {
      const r = rng.pick([2, 3]);
      return { rule: { type: 'cycle', ops: [{ op: '/', v: r }] }, start: [rng.int(1, 5) * r ** 4], shown: 4 };
    },
  ],
  medium: [
    (rng) => ({ rule: { type: 'addInc', d: rng.int(1, 5), inc: rng.int(1, 3) }, start: [rng.int(1, 20)], shown: 5 }),
    (rng) => {
      const da = rng.int(2, 6);
      const db = -rng.int(2, 6);
      return {
        rule: { type: 'interleave', a: { type: 'add', d: da }, b: { type: 'add', d: db } },
        start: [rng.int(1, 20), rng.int(35, 70)],
        shown: 6,
      };
    },
    (rng) => {
      const a = rng.int(1, 6);
      const ops: SeriesOp[] = rng.chance(0.5)
        ? [{ op: '+', v: a }, { op: '*', v: 2 }]
        : [{ op: '*', v: 2 }, { op: '-', v: a }];
      return { rule: { type: 'cycle', ops }, start: [rng.int(a + 1, 9)], shown: 5 };
    },
    (rng) => ({
      rule: { type: 'power', exp: 2, offset: rng.pick([0, 0, 1, -1, 2]), startN: rng.int(1, 4) },
      start: [],
      shown: 5,
    }),
  ],
  hard: [
    (rng) => ({
      rule: { type: 'mulAdd', m: rng.pick([2, 3]), a: rng.pick([-2, -1, 1, 2, 3, 4]) },
      start: [rng.int(2, 6)],
      shown: 4,
    }),
    (rng) => ({ rule: { type: 'sumPrev' }, start: [rng.int(1, 5), rng.int(2, 8)], shown: 6 }),
    (rng) => ({ rule: { type: 'addInc', d: rng.int(2, 6), inc: rng.int(2, 5) }, start: [rng.int(1, 30)], shown: 5 }),
    (rng) => {
      const ops: SeriesOp[] = [
        { op: '+', v: rng.int(1, 5) },
        { op: '*', v: 2 },
        { op: '-', v: rng.int(1, 4) },
      ];
      return { rule: { type: 'cycle', ops }, start: [rng.int(2, 9)], shown: 6 };
    },
    (rng) => ({
      rule: { type: 'power', exp: 3, offset: rng.pick([-2, -1, 1, 2]), startN: rng.int(1, 2) },
      start: [],
      shown: 4,
    }),
    (rng) => ({
      rule: { type: 'interleave', a: { type: 'add', d: rng.int(3, 7) }, b: { type: 'mul', r: 2 } },
      start: [rng.int(1, 10), rng.int(1, 4)],
      shown: 7,
    }),
  ],
};

function describeSimple(rule: SeriesRule): string {
  switch (rule.type) {
    case 'add':
      return rule.d >= 0 ? `עולה ב-${rule.d} בכל צעד` : `יורדת ב-${-rule.d} בכל צעד`;
    case 'mul':
      return `כל מספר גדול פי ${rule.r} מהקודם`;
    default:
      return '';
  }
}

function stepText(rule: SeriesRule, last: number, prev: number, ans: number, shown: number, all: number[]): string {
  switch (rule.type) {
    case 'add':
      return rule.d >= 0
        ? `בכל צעד מוסיפים ${rule.d}: ${all.slice(0, shown).join(' → ')}. לכן המספר הבא הוא ${last} + ${rule.d} = ${ans}.`
        : `בכל צעד מחסירים ${-rule.d}: ${all.slice(0, shown).join(' → ')}. לכן המספר הבא הוא ${last} − ${-rule.d} = ${ans}.`;
    case 'mul':
      return `כל מספר גדול פי ${rule.r} מהקודם: ${all.slice(0, shown).join(' → ')}. לכן המספר הבא הוא ${last} × ${rule.r} = ${ans}.`;
    case 'addInc': {
      const diffs = all.slice(1, shown).map((t, i) => t - all[i]);
      return `ההפרשים בין המספרים הם ${diffs.join(', ')}, וכל הפרש גדול ב-${rule.inc} מהקודם. ההפרש הבא הוא ${ans - last}, ולכן המספר הבא הוא ${last} + ${ans - last} = ${ans}.`;
    }
    case 'mulAdd': {
      const sign = rule.a >= 0 ? `ועוד ${rule.a}` : `פחות ${-rule.a}`;
      const s = rule.a >= 0 ? '+' : '−';
      return `כל מספר שווה לקודם כפול ${rule.m} ${sign}. למשל: ${all[0]} × ${rule.m} ${s} ${Math.abs(rule.a)} = ${all[1]}. לכן המספר הבא הוא ${last} × ${rule.m} ${s} ${Math.abs(rule.a)} = ${ans}.`;
    }
    case 'cycle': {
      if (rule.ops.length === 1) {
        const o = rule.ops[0];
        return `בכל צעד ${opWords(o)}: ${all.slice(0, shown).join(' → ')}. לכן המספר הבא הוא ${last} ${opSym(o.op)} ${o.v} = ${ans}.`;
      }
      const next = rule.ops[(shown - 1) % rule.ops.length];
      const list = rule.ops.map(opWords).join(', ואז ');
      return `הפעולות מתחלפות לפי הסדר: ${list}, וחוזר חלילה. עכשיו הגיע התור של "${opWords(next)}", ולכן המספר הבא הוא ${last} ${opSym(next.op)} ${next.v} = ${ans}.`;
    }
    case 'sumPrev':
      return `כל מספר הוא סכום שני המספרים שלפניו (למשל ${all[0]} + ${all[1]} = ${all[2]}). לכן המספר הבא הוא ${prev} + ${last} = ${ans}.`;
    case 'power': {
      const sup = SUP[rule.exp] ?? `^${rule.exp}`;
      const off = rule.offset === 0 ? '' : rule.offset > 0 ? ` + ${rule.offset}` : ` − ${-rule.offset}`;
      const kind = rule.exp === 2 ? 'ריבועים של מספרים עוקבים' : 'מספרים עוקבים בחזקה שלישית';
      const offWords = rule.offset === 0 ? '' : rule.offset > 0 ? ` ועוד ${rule.offset}` : ` פחות ${-rule.offset}`;
      const examples = all
        .slice(0, 3)
        .map((t, i) => `${rule.startN + i}${sup}${off} = ${t}`)
        .join(', ');
      return `אלו ${kind}${offWords}: ${examples} וכן הלאה. המספר הבא הוא ${rule.startN + shown}${sup}${off} = ${ans}.`;
    }
    case 'interleave': {
      const odd = all.filter((_, i) => i % 2 === 0 && i < shown);
      const even = all.filter((_, i) => i % 2 === 1 && i < shown);
      const nextIsOdd = shown % 2 === 0;
      const sub = nextIsOdd ? rule.a : rule.b;
      const lastOfSub = nextIsOdd ? odd[odd.length - 1] : even[even.length - 1];
      const calc =
        sub.type === 'add'
          ? sub.d >= 0
            ? `${lastOfSub} + ${sub.d}`
            : `${lastOfSub} − ${-sub.d}`
          : sub.type === 'mul'
            ? `${lastOfSub} × ${sub.r}`
            : `${lastOfSub}`;
      return `אלו שתי סדרות ששזורות זו בזו. במקומות האי-זוגיים (ראשון, שלישי, חמישי...) מופיעה הסדרה ${odd.join(', ')}, ש${describeSimple(rule.a)}. במקומות הזוגיים מופיעה הסדרה ${even.join(', ')}, ש${describeSimple(rule.b)}. המספר החסר נמצא במקום ה-${shown + 1}, ${nextIsOdd ? 'מקום אי-זוגי' : 'מקום זוגי'}, ולכן הוא ${calc} = ${ans}.`;
    }
  }
}

function build(rng: Rng, difficulty: Difficulty): GeneratedDraft {
  for (let attempt = 0; attempt < 50; attempt++) {
    const plan = rng.pick(PLANS[difficulty])(rng);
    const all = seriesTerms(plan.rule, plan.start, plan.shown + 1);
    if (!all.every((t) => Number.isInteger(t) && Math.abs(t) <= 3000)) continue;
    const shownTerms = all.slice(0, plan.shown);
    if (new Set(shownTerms).size < shownTerms.length - 1) continue; // סדרה משעממת מדי
    const ans = all[plan.shown];
    const last = shownTerms[shownTerms.length - 1];
    const prev = shownTerms[shownTerms.length - 2];

    const candidates = [last + (last - prev), ans + 1, ans - 1, ans + (ans - last), last * 2, ans + 2, ans - 2];
    if (plan.rule.type === 'interleave') {
      // הטעות הנפוצה: להמשיך את הסדרה השנייה
      const other = seriesTerms(plan.rule, plan.start, plan.shown + 2)[plan.shown + 1];
      candidates.unshift(other);
    }
    const { choices, correctChoiceId } = numericChoices(rng, ans, candidates, { integer: true });
    return {
      subtopic: 'series',
      prompt: [text('איזה מספר ממשיך את הסדרה?'), text(formatSeries(shownTerms), true)],
      choices,
      correctChoiceId,
      explanation: stepText(plan.rule, last, prev, ans, plan.shown, all),
      verify: { kind: 'series', rule: plan.rule, start: plan.start, shown: plan.shown },
    };
  }
  throw new Error('series generator failed to build a question');
}

export const seriesGenerator: QuestionGenerator = {
  id: 'series',
  topic: 'quantitative',
  subtopic: 'series',
  build,
};
