import type { Rng } from '../../engine/rng';
import { fmt, numericChoices, text, type GeneratedDraft, type QuestionGenerator, type Template } from './common';
import type { Difficulty } from '../types';

function exprQuestion(
  rng: Rng,
  display: string,
  expr: string,
  answer: number,
  candidates: number[],
  explanation: string,
): GeneratedDraft {
  const { choices, correctChoiceId } = numericChoices(rng, answer, candidates);
  return {
    subtopic: 'arithmetic',
    prompt: [text('כמה זה?'), text(`${display} = ?`, true)],
    choices,
    correctChoiceId,
    explanation,
    verify: { kind: 'expr', expr },
  };
}

const easy: Template[] = [
  (rng) => {
    const a = rng.int(2, 20), b = rng.int(2, 9), c = rng.int(2, 9);
    const ans = a + b * c;
    return exprQuestion(rng, `${a} + ${b} × ${c}`, `${a}+${b}*${c}`, ans, [(a + b) * c, a + b + c, ans + c],
      `לפי סדר פעולות החשבון, כפל קודם לחיבור: ${b} × ${c} = ${b * c}, ואז ${a} + ${b * c} = ${ans}. מי שמחבר קודם מקבל בטעות ${a + b} × ${c} = ${(a + b) * c}.`);
  },
  (rng) => {
    const b = rng.int(2, 9), q = rng.int(4, 12), c = rng.int(1, q - 1);
    const a = b * q;
    const ans = q - c;
    return exprQuestion(rng, `${a} ÷ ${b} − ${c}`, `${a}/${b}-${c}`, ans, [b > c ? a / (b - c) : q + c, q + c, q],
      `חילוק קודם לחיסור: ${a} ÷ ${b} = ${q}, ואז ${q} − ${c} = ${ans}.`);
  },
  (rng) => {
    const a = rng.int(120, 900), b = rng.int(15, 99);
    const ans = a - b;
    const roundB = Math.ceil(b / 10) * 10;
    return exprQuestion(rng, `${a} − ${b}`, `${a}-${b}`, ans, [ans + 10, ans - 10, ans + 2, ans - 2],
      roundB === b
        ? `${b} הוא מספר עגול, אז אפשר לחסר אותו ישירות: ${a} − ${b} = ${ans}.`
        : `אפשר לחסר מספר עגול ולתקן: ${a} − ${roundB} = ${a - roundB}, ומכיוון שחיסרנו ${roundB - b} יותר מדי, מוסיפים אותם בחזרה: ${a - roundB} + ${roundB - b} = ${ans}.`);
  },
];

const medium: Template[] = [
  (rng) => {
    const a = rng.int(5, 20), b = rng.int(2, 12), c = rng.int(2, 6), d = rng.int(1, 15);
    const ans = (a + b) * c - d;
    return exprQuestion(rng, `(${a} + ${b}) × ${c} − ${d}`, `(${a}+${b})*${c}-${d}`, ans,
      [a + b * c - d, (a + b) * (c - d), ans + c, ans + 2 * d],
      `קודם הסוגריים: ${a} + ${b} = ${a + b}. אחר כך הכפל: ${a + b} × ${c} = ${(a + b) * c}. ולבסוף החיסור: ${(a + b) * c} − ${d} = ${ans}.`);
  },
  (rng) => {
    // מספר עשרוני כפול שלם
    const tenths = rng.pick([2, 4, 5, 6, 8]);
    const n = rng.pick([5, 10, 15, 20, 25, 30, 35, 40, 45]);
    const ans = (tenths * n) / 10;
    return exprQuestion(rng, `0.${tenths} × ${n}`, `0.${tenths}*${n}`, ans, [ans * 10, ans / 10, ans + tenths / 10, n - tenths],
      `0.${tenths} הם ${tenths} עשיריות. ${tenths} × ${n} = ${tenths * n}, ומחלקים ב-10 בגלל העשיריות: ${tenths * n} ÷ 10 = ${fmt(ans)}.`);
  },
  (rng) => {
    const n = rng.int(3, 20), m = rng.int(2, 9), a = rng.int(1, 20);
    const r = n * m + a;
    const { choices, correctChoiceId } = numericChoices(rng, n, [(r + a) / m, r / m - a, n + 1, n - 1, r - a], { integer: true, min: 0 });
    return {
      subtopic: 'arithmetic',
      prompt: [text(`מספר מסוים כפול ${m}, ועוד ${a}, שווה ${r}. מהו המספר?`)],
      choices,
      correctChoiceId,
      explanation: `עובדים אחורה: קודם מחסירים את ה-${a}: ${r} − ${a} = ${r - a}, ואז מחלקים ב-${m}: ${r - a} ÷ ${m} = ${n}. בדיקה: ${n} × ${m} + ${a} = ${r}.`,
      verify: { kind: 'expr', expr: `(${r}-${a})/${m}` },
    };
  },
];

const hard: Template[] = [
  (rng) => {
    const a = rng.int(2, 9), b = rng.int(2, 5), c = rng.int(2, 9);
    const ans = a ** 2 + b ** 3 - c ** 2;
    return exprQuestion(rng, `${a}² + ${b}³ − ${c}²`, `${a}^2+${b}^3-${c}^2`, ans,
      [a * 2 + b * 3 - c * 2, a ** 2 + b ** 2 - c ** 2, ans + c, ans - b],
      `מחשבים כל חזקה בנפרד: ${a}² = ${a ** 2}, ${b}³ = ${b ** 3}, ${c}² = ${c ** 2}. ואז: ${a ** 2} + ${b ** 3} − ${c ** 2} = ${ans}. טעות נפוצה היא לכפול במעריך (למשל ${b} × 3) במקום להעלות בחזקה.`);
  },
  (rng) => {
    const k = rng.pick([4, 5]);
    for (;;) {
      const avg = rng.int(12, 40);
      const known = Array.from({ length: k - 1 }, () => rng.int(5, 60));
      const sum = known.reduce((s, x) => s + x, 0);
      const x = k * avg - sum;
      if (x < 1 || x > 99 || known.includes(x)) continue;
      const list = known.slice(0, -1).join(', ') + ' ו-' + known[known.length - 1];
      const { choices, correctChoiceId } = numericChoices(rng, x, [avg, Math.round(sum / (k - 1)), x + k, x - k, (k - 1) * avg - sum], { integer: true, min: 1 });
      return {
        subtopic: 'arithmetic',
        prompt: [text(`הממוצע של ${k} מספרים הוא ${avg}. ${k - 1} מהם הם ${list}. מהו המספר הנותר?`)],
        choices,
        correctChoiceId,
        explanation: `אם הממוצע של ${k} מספרים הוא ${avg}, הסכום שלהם הוא ${k} × ${avg} = ${k * avg}. סכום המספרים הידועים הוא ${known.join(' + ')} = ${sum}. לכן המספר הנותר הוא ${k * avg} − ${sum} = ${x}.`,
        verify: { kind: 'expr', expr: `${k}*${avg}-${known.join('-')}` },
      };
    }
  },
  (rng) => {
    const c = rng.int(2, 5), d = rng.pick([1.5, 2.5, 3, 4]);
    const b = rng.int(1, 6);
    const inner = b + c * d;
    if (!Number.isInteger(inner)) return hard[0](rng);
    const q = rng.int(2, 8);
    const a = inner * q;
    return exprQuestion(rng, `${a} ÷ (${b} + ${c} × ${d})`, `${a}/(${b}+${c}*${d})`, q,
      [a / ((b + c) * d), a / b + c * d, q * 2, inner],
      `מתחילים בסוגריים, ובתוכם כפל לפני חיבור: ${c} × ${d} = ${fmt(c * d)}, ואז ${b} + ${fmt(c * d)} = ${inner}. לבסוף ${a} ÷ ${inner} = ${q}.`);
  },
];

const TEMPLATES: Record<Difficulty, Template[]> = { easy, medium, hard };

export const arithmeticGenerator: QuestionGenerator = {
  id: 'arithmetic',
  topic: 'quantitative',
  subtopic: 'arithmetic',
  build: (rng, difficulty) => rng.pick(TEMPLATES[difficulty])(rng),
};
