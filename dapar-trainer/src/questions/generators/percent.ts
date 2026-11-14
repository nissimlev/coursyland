import type { Rng } from '../../engine/rng';
import { round2 } from '../../lib/format';
import type { Difficulty } from '../types';
import { fmt, gcd, numericChoices, shekel, text, type GeneratedDraft, type QuestionGenerator, type Template } from './common';

const pct = (n: number) => `${fmt(n)}%`;

function q(
  rng: Rng,
  promptText: string,
  answer: number,
  candidates: number[],
  explanation: string,
  expr: string,
  format?: (n: number) => string,
): GeneratedDraft {
  const { choices, correctChoiceId } = numericChoices(rng, answer, candidates, { format, min: 0 });
  return {
    subtopic: 'percent-ratio',
    prompt: [text(promptText)],
    choices,
    correctChoiceId,
    explanation,
    verify: { kind: 'expr', expr },
  };
}

/** מספר n בטווח כך ש-p% ממנו שלם */
function niceBase(rng: Rng, p: number, min: number, max: number): number {
  const step = 100 / gcd(p, 100);
  const lo = Math.ceil(min / step);
  const hi = Math.floor(max / step);
  return rng.int(lo, hi) * step;
}

/** פריט + הפועל בעתיד בהתאם למין הדקדוקי שלו */
const ITEMS = [
  ['חולצה', 'תעלה'],
  ['ספר', 'יעלה'],
  ['זוג נעליים', 'יעלה'],
  ['תיק', 'יעלה'],
  ['משחק', 'יעלה'],
  ['מעיל', 'יעלה'],
  ['מכנסיים', 'יעלו'],
] as const;

const easy: Template[] = [
  (rng) => {
    const p = rng.pick([10, 20, 25, 30, 40, 50, 75, 5]);
    const n = niceBase(rng, p, 20, 800);
    const ans = (n * p) / 100;
    return q(rng, `כמה הם ${p}% מ-${n}?`, ans, [n - ans, ans * 2, ans / 2, (n * p) / 10, ans + 10],
      `${p}% מ-${n} זה ${p}/100 × ${n}. אחוז אחד מ-${n} הוא ${fmt(n / 100)}, ולכן ${p}% הם ${fmt(n / 100)} × ${p} = ${fmt(ans)}.`,
      `${n}*${p}/100`);
  },
  (rng) => {
    const p = rng.pick([10, 20, 25, 30, 40, 50]);
    const price = niceBase(rng, p, 40, 400);
    const [item, verb] = rng.pick(ITEMS);
    const disc = (price * p) / 100;
    const ans = price - disc;
    const now = verb === 'תעלה' ? 'עולה' : verb === 'יעלו' ? 'עולים' : 'עולה';
    return q(rng, `${item} ${now} ${shekel(price)}. בהנחה של ${p}%, כמה ${verb}?`, ans, [disc, price - p, ans - 10, price + disc],
      `ההנחה היא ${p}% מ-${price}, כלומר ${fmt(disc)} ש״ח. המחיר אחרי ההנחה: ${price} − ${fmt(disc)} = ${shekel(ans)}.`,
      `${price}*(100-${p})/100`, shekel);
  },
  (rng) => {
    const a = rng.int(1, 5);
    let b = rng.int(2, 7);
    if (gcd(a, b) !== 1 || a === b) b = a + 1;
    const groups = rng.int(3, 12);
    const total = (a + b) * groups;
    const ans = b * groups;
    return q(rng, `בקופסה יש ${total} כדורים כחולים ואדומים, והיחס בין הכחולים לאדומים הוא ${a}:${b}. כמה כדורים אדומים יש בקופסה?`,
      ans, [a * groups, total / b, total - a, groups],
      `היחס ${a}:${b} אומר שמכל ${a + b} כדורים, ${a} כחולים ו-${b} אדומים. בקופסה יש ${total} ÷ ${a + b} = ${groups} קבוצות כאלה, ולכן יש ${groups} × ${b} = ${ans} כדורים אדומים.`,
      `${total}*${b}/(${a}+${b})`);
  },
];

const medium: Template[] = [
  (rng) => {
    const p = rng.pick([10, 15, 20, 25, 40, 50, 75]);
    const up = rng.chance(0.5);
    const x = niceBase(rng, p, 20, 400);
    const y = up ? x + (x * p) / 100 : x - (x * p) / 100;
    const diff = Math.abs(y - x);
    return q(rng, `מחיר של מוצר ${up ? 'עלה' : 'ירד'} מ-${x} ש״ח ל-${y} ש״ח. בכמה אחוזים ${up ? 'עלה' : 'ירד'} המחיר?`, p,
      [round2((diff / y) * 100), diff, p + 5, p - 5],
      `השינוי הוא ${diff} ש״ח. את אחוז השינוי מחשבים תמיד ביחס למחיר המקורי (${x}), לא למחיר החדש: ${diff} ÷ ${x} = ${fmt(p / 100)}, כלומר ${pct(p)}.`,
      `(${up ? `${y}-${x}` : `${x}-${y}`})/${x}*100`, pct);
  },
  (rng) => {
    const p = rng.pick([5, 15, 35, 45, 60, 65, 80, 12, 24]);
    const b = niceBase(rng, p, 20, 300);
    const a = (b * p) / 100;
    return q(rng, `${a} הם כמה אחוזים מ-${b}?`, p, [100 - p, p + 10, a, round2((b / a) * 10)],
      `מחלקים את החלק בשלם: ${a} ÷ ${b} = ${fmt(p / 100)}, ובאחוזים: ${pct(p)}.`,
      `${a}/${b}*100`, pct);
  },
  (rng) => {
    const p = rng.pick([10, 20, 25, 40, 50]);
    const keep = 100 - p;
    const original = niceBase(rng, keep, 40, 500);
    const paid = (original * keep) / 100;
    const [item] = rng.pick(ITEMS);
    return q(rng, `אחרי הנחה של ${p}% שילמו על ${item} ${shekel(paid)}. מה היה המחיר המקורי?`, original,
      [round2(paid * (1 + p / 100)), paid + p, round2(paid * (1 - p / 100))],
      `אחרי הנחה של ${p}% משלמים ${keep}% מהמחיר המקורי. לכן ${paid} ש״ח הם ${keep}% מהמחיר, ו-1% הוא ${paid} ÷ ${keep} = ${fmt(paid / keep)}. המחיר המלא (100%) הוא ${shekel(original)}. טעות נפוצה: להוסיף ${p}% למחיר ששולם.`,
      `${paid}/${keep}*100`, shekel);
  },
  (rng) => {
    const k = rng.pick([2, 3, 4, 5]);
    let m = rng.pick([3, 6, 8, 9, 10, 12]);
    if (m === k) m = k * 3;
    const per = rng.pick([50, 60, 75, 80, 100, 120, 150]);
    const g = per * k;
    const ans = per * m;
    return q(rng, `מתכון ל-${k} אנשים דורש ${g} גרם קמח. כמה קמח צריך לאותו מתכון בשביל ${m} אנשים?`, ans,
      [g + (m - k) * 10, g * m, ans + per, ans - per],
      `לכל אדם צריך ${g} ÷ ${k} = ${per} גרם. ל-${m} אנשים: ${per} × ${m} = ${ans} גרם.`,
      `${g}/${k}*${m}`, (n) => `${fmt(n)} גרם`);
  },
];

const hard: Template[] = [
  (rng) => {
    const p = rng.pick([10, 20, 25, 50]);
    const qq = rng.pick([10, 20, 25, 50]);
    const price = rng.pick([100, 200, 400, 800, 1000]);
    const final = round2(price * (1 + p / 100) * (1 - qq / 100));
    return q(rng, `מחיר של מוצר היה ${shekel(price)}. המחיר עלה ב-${p}%, ואחר כך ירד ב-${qq}%. מה המחיר הסופי?`, final,
      [price * (1 + (p - qq) / 100), price, round2(price * (1 - p / 100) * (1 + qq / 100)) + 1, final + 10],
      `אחרי עלייה של ${p}% המחיר הוא ${price} × ${fmt(1 + p / 100)} = ${fmt(price * (1 + p / 100))}. הירידה של ${qq}% מחושבת מהמחיר החדש: ${fmt(price * (1 + p / 100))} × ${fmt(1 - qq / 100)} = ${shekel(final)}. אסור פשוט לחבר ולחסר את האחוזים.`,
      `${price}*(1+${p}/100)*(1-${qq}/100)`, shekel);
  },
  (rng) => {
    // A יקר מ-B ב-p%. בכמה אחוזים B זול מ-A?
    const [p, ans] = rng.pick([[25, 20], [100, 50], [150, 60], [300, 75], [400, 80], [60, 37.5]] as const);
    const b = rng.pick([40, 80, 120, 200]);
    const a = b * (1 + p / 100);
    return q(rng, `מחיר מחשב נייד גבוה ב-${p}% ממחיר טאבלט. בכמה אחוזים מחיר הטאבלט נמוך ממחיר המחשב?`, ans,
      [p, 100 - ans + 5, Math.max(1, p - 10), round2(100 - p / 2)],
      `נניח שהטאבלט עולה ${b} ש״ח. המחשב יקר ממנו ב-${p}%, כלומר עולה ${fmt(a)} ש״ח. ההפרש הוא ${fmt(a - b)} ש״ח, ועכשיו מחשבים אותו ביחס למחיר המחשב: ${fmt(a - b)} ÷ ${fmt(a)} = ${fmt(ans / 100)}, כלומר ${pct(ans)}. התשובה לא ${p}%, כי בכל פעם האחוז מחושב ביחס למחיר אחר.`,
      `${p}/(100+${p})*100`, pct);
  },
  (rng) => {
    // תערובת: כמה ליטר מיץ להוסיף כדי להגיע ל-t%
    for (;;) {
      const t = rng.pick([20, 25, 40, 50, 60]);
      const finalTotal = rng.pick([10, 12, 15, 20, 24, 25, 30]);
      const finalJuice = (finalTotal * t) / 100;
      if (!Number.isInteger(finalJuice)) continue;
      const x = rng.int(1, Math.max(1, finalJuice - 1));
      const juice = finalJuice - x;
      const water = finalTotal - finalJuice;
      if (juice < 1 || water < 1) continue;
      const start = juice + water;
      return q(rng, `בכד יש ${juice} ליטר מיץ ו-${water} ליטר מים. כמה ליטר מיץ צריך להוסיף כדי שהמיץ יהיה ${t}% מהתערובת?`, x,
        [round2((start * t) / 100 - juice), finalJuice, x + 1, round2((start * t) / 100)],
        `נסמן ב-x את כמות המיץ שמוסיפים. אחרי ההוספה יש ${juice} + x ליטר מיץ מתוך ${start} + x ליטר. בדיקה עם x = ${x}: יש ${finalJuice} ליטר מיץ מתוך ${finalTotal} ליטר, ו-${finalJuice} ÷ ${finalTotal} = ${fmt(t / 100)}, כלומר ${t}%. לכן צריך להוסיף ${fmt(x)} ליטר. טעות נפוצה היא לשכוח שגם הכמות הכוללת גדלה.`,
        `(${t}/100*${start}-${juice})/(1-${t}/100)`, (n) => `${fmt(n)} ליטר`);
    }
  },
];

const TEMPLATES: Record<Difficulty, Template[]> = { easy, medium, hard };

export const percentGenerator: QuestionGenerator = {
  id: 'percent',
  topic: 'quantitative',
  subtopic: 'percent-ratio',
  build: (rng, difficulty) => rng.pick(TEMPLATES[difficulty])(rng),
};
