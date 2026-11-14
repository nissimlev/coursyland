import type { Rng } from '../../engine/rng';
import type { Difficulty } from '../types';
import { FEMALE_NAMES, MALE_NAMES, fmt, numericChoices, shekel, text, type GeneratedDraft, type QuestionGenerator, type Template } from './common';

function q(
  rng: Rng,
  promptText: string,
  answer: number,
  candidates: number[],
  explanation: string,
  expr: string,
  format?: (n: number) => string,
  extra: { integer?: boolean; values?: boolean } = {},
): GeneratedDraft {
  const { choices, correctChoiceId } = numericChoices(rng, answer, candidates, { format, min: 0, integer: extra.integer });
  return {
    subtopic: 'word-problem',
    prompt: [text(promptText)],
    choices,
    correctChoiceId,
    explanation,
    verify: { kind: 'expr', expr },
  };
}

const hours = (n: number) => (n === 1 ? 'שעה אחת' : `${fmt(n)} שעות`);
const minutes = (n: number) => `${fmt(n)} דקות`;
const hhmm = (total: number) => `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

const easy: Template[] = [
  (rng) => {
    const v = rng.pick([40, 50, 60, 70, 80, 90, 100]);
    const t = rng.pick([1.5, 2, 2.5, 3, 4]);
    const d = v * t;
    return q(rng, `מכונית נוסעת במהירות קבועה של ${v} קמ״ש. כמה קילומטרים היא תעבור ב-${fmt(t)} שעות?`, d,
      [v + t, v * (t + 1), v * Math.floor(t), d - 10],
      `דרך = מהירות × זמן. לכן המכונית תעבור ${v} × ${fmt(t)} = ${fmt(d)} ק״מ.`,
      `${v}*${t}`, (n) => `${fmt(n)} ק״מ`);
  },
  (rng) => {
    const k = rng.pick([4, 5, 6, 8, 10, 12]);
    const c = rng.pick([10, 12, 15, 18, 20, 24, 30]);
    const packs = rng.int(2, 6);
    const m = k * packs;
    const ans = c * packs;
    return q(rng, `מארז של ${k} בקבוקי מים עולה ${shekel(c)}. כמה יעלו ${m} בקבוקים?`, ans,
      [c * m, c + m, ans + c, ans - c],
      `${m} בקבוקים הם ${packs} מארזים (${m} ÷ ${k} = ${packs}). לכן המחיר הוא ${packs} × ${c} = ${shekel(ans)}.`,
      `${m}/${k}*${c}`, shekel);
  },
  (rng) => {
    const name = rng.pick(MALE_NAMES);
    const a = rng.int(5, 12), f = rng.int(3, 5), y = rng.int(2, 10);
    const ans = a * f + y;
    return q(rng, `${name} בן ${a}, ואביו מבוגר ממנו פי ${f}. בן כמה יהיה האב בעוד ${y} שנים?`, ans,
      [(a + y) * f, a * f, a * f - y, a + y],
      `היום האב בן ${a} × ${f} = ${a * f}. בעוד ${y} שנים הוא יהיה בן ${a * f} + ${y} = ${ans}. שימו לב: היחס בין הגילים משתנה עם השנים, ולכן לא כופלים ב-${f} את הגיל העתידי של ${name}.`,
      `${a}*${f}+${y}`, undefined, { integer: true });
  },
  (rng) => {
    const name = rng.pick(FEMALE_NAMES);
    const part = rng.pick([3, 4]);
    const n = part * rng.int(4, 10);
    const given = n / part;
    const k = rng.int(2, Math.min(9, n - given - 1));
    const ans = n - given - k;
    const word = part === 3 ? 'שליש' : 'רבע';
    return q(rng, `ל${name} היו ${n} מדבקות. היא נתנה ${word} מהן לאחיה, ועוד ${k} מדבקות לחברה. כמה מדבקות נשארו לה?`, ans,
      [n - given, n - k, given - k > 0 ? given - k : ans + part, ans + 2],
      `${word} מ-${n} הוא ${given}, אז אחרי שנתנה לאחיה נשארו לה ${n} − ${given} = ${n - given}. אחרי שנתנה עוד ${k} נשארו ${n - given} − ${k} = ${ans} מדבקות.`,
      `${n}-${n}/${part}-${k}`, undefined, { integer: true });
  },
];

const medium: Template[] = [
  (rng) => {
    const [a, b] = rng.pick([[3, 6], [4, 12], [6, 12], [10, 15], [12, 24], [20, 30], [6, 3], [12, 4], [15, 10]] as const);
    const ans = (a * b) / (a + b);
    return q(rng, `צבעי אחד צובע חדר ב-${a} שעות, וצבעי אחר צובע את אותו חדר ב-${b} שעות. כמה זמן ייקח להם לצבוע את החדר יחד?`, ans,
      [(a + b) / 2, a + b, Math.min(a, b) - 1, Math.abs(a - b)],
      `בשעה אחת הראשון צובע 1/${a} מהחדר, והשני 1/${b} מהחדר. יחד הם צובעים בשעה 1/${a} + 1/${b} = ${a + b}/${a * b} מהחדר. לכן כל החדר ייצבע ב-${a * b} ÷ ${a + b} = ${hours(ans)}.`,
      `1/(1/${a}+1/${b})`, hours);
  },
  (rng) => {
    const net = rng.int(3, 8), leak = rng.int(1, 4);
    const t = rng.pick([10, 12, 15, 20, 25, 30]);
    const cap = net * t;
    const inRate = net + leak;
    return q(rng, `ברז ממלא מיכל של ${cap} ליטר בקצב של ${inRate} ליטר בדקה, אבל מהמיכל דולפים ${leak} ליטר בדקה. תוך כמה דקות יתמלא המיכל?`, t,
      [cap / inRate, cap / (inRate + leak), t + leak, t - leak],
      `בכל דקה המיכל מתמלא בפועל ב-${inRate} − ${leak} = ${net} ליטר. לכן הוא יתמלא תוך ${cap} ÷ ${net} = ${minutes(t)}.`,
      `${cap}/(${inRate}-${leak})`, minutes);
  },
  (rng) => {
    for (;;) {
      const n = rng.pick([9, 10, 14, 19, 20, 24, 29]);
      const m = rng.int(60, 85);
      const d = rng.int(1, 3);
      const s = (n + 1) * (m + d) - n * m;
      if (s > 100) continue;
      const ans = m + d;
      return q(rng, `הממוצע של ${n} תלמידים במבחן היה ${m}. הצטרף תלמיד נוסף שקיבל ${s}. מה הממוצע החדש של הקבוצה?`, ans,
        [(m + s) / 2, m + s / n, m + 1 === ans ? m + 2 : m + 1, m],
        `סכום הציונים של ${n} התלמידים הוא ${n} × ${m} = ${n * m}. עם התלמיד החדש הסכום הוא ${n * m} + ${s} = ${n * m + s}, ויש ${n + 1} תלמידים. הממוצע החדש: ${n * m + s} ÷ ${n + 1} = ${ans}. טעות נפוצה היא לחשב ממוצע של ${m} ו-${s} בלבד.`,
        `(${n}*${m}+${s})/(${n}+1)`);
    }
  },
  (rng) => {
    const start = rng.int(6, 14) * 60 + rng.pick([10, 20, 25, 35, 40, 45, 50]);
    const dh = rng.int(1, 3);
    const dm = rng.pick([25, 35, 40, 45, 50]);
    const end = start + dh * 60 + dm;
    const sh = Math.floor(start / 60), sm = start % 60;
    const ans = end;
    // מסיחים: שכחו להעביר 60 דקות לשעה (end − 60), או טעות של 10 דקות
    const { choices, correctChoiceId } = numericChoices(rng, ans, [end - 60, end + 60, end + 10, end - 10], { format: hhmm, integer: true });
    return {
      subtopic: 'word-problem',
      prompt: [text(`רכבת יצאה בשעה ${hhmm(start)}, והנסיעה נמשכה ${dh === 1 ? 'שעה' : dh === 2 ? 'שעתיים' : `${dh} שעות`} ו-${dm} דקות. באיזו שעה הגיעה הרכבת?`)],
      choices,
      correctChoiceId,
      explanation: `מוסיפים קודם את השעות: ${dh === 1 ? 'שעה' : `${dh} שעות`} אחרי ${hhmm(start)} זה ${hhmm(start + dh * 60)}. אחר כך את הדקות: ${sm} + ${dm} = ${sm + dm} דקות${sm + dm >= 60 ? `, שהן שעה ועוד ${sm + dm - 60} דקות` : ''}. לכן הרכבת הגיעה ב-${hhmm(end)}.`,
      verify: { kind: 'expr', expr: `${sh}*60+${sm}+${dh}*60+${dm}` },
    };
  },
];

const hard: Template[] = [
  (rng) => {
    const v1 = rng.pick([10, 15, 20, 30, 40]);
    const v2 = v1 + rng.pick([5, 10, 20]);
    const t = rng.pick([1.5, 2, 2.5, 3]);
    const D = (v1 + v2) * t;
    return q(rng, `שני רוכבים יוצאים באותו זמן זה לקראת זה משתי נקודות שהמרחק ביניהן ${fmt(D)} ק״מ. מהירות אחד ${v1} קמ״ש ומהירות השני ${v2} קמ״ש. אחרי כמה זמן ייפגשו?`, t,
      [D / (v2 - v1), D / v2, D / (v1 + v2) + 1, t + 0.5],
      `כשנוסעים זה לקראת זה, המרחק ביניהם קטן בכל שעה ב-${v1} + ${v2} = ${v1 + v2} ק״מ. לכן הם ייפגשו אחרי ${fmt(D)} ÷ ${v1 + v2} = ${hours(t)}.`,
      `${D}/(${v1}+${v2})`, hours);
  },
  (rng) => {
    const k = rng.pick([3, 5]);
    const mid = rng.int(12, 60);
    const sum = mid * k;
    const largest = mid + (k - 1) / 2;
    const smallest = mid - (k - 1) / 2;
    const askLargest = rng.chance(0.5);
    const ans = askLargest ? largest : smallest;
    const nums = Array.from({ length: k }, (_, i) => smallest + i);
    return q(rng, `סכום של ${k} מספרים שלמים עוקבים הוא ${sum}. מהו ה${askLargest ? 'גדול' : 'קטן'} מביניהם?`, ans,
      [mid, askLargest ? smallest : largest, ans + (askLargest ? 1 : -1), sum / (k + 1)],
      `במספרים עוקבים, המספר האמצעי שווה לממוצע: ${sum} ÷ ${k} = ${mid}. לכן המספרים הם ${nums.join(', ')}, וה${askLargest ? 'גדול' : 'קטן'} מביניהם הוא ${ans}.`,
      askLargest ? `${sum}/${k}+(${k}-1)/2` : `${sum}/${k}-(${k}-1)/2`, undefined, { integer: true });
  },
  (rng) => {
    const [lo, hi] = rng.pick([[2, 5], [1, 5], [5, 10], [1, 2]] as const);
    const N = rng.int(12, 30);
    const big = rng.int(2, N - 2);
    const small = N - big;
    const V = big * hi + small * lo;
    return q(rng, `בקופה יש ${N} מטבעות, חלקם של ${lo} ש״ח וחלקם של ${hi} ש״ח. סכום הכסף בקופה הוא ${V} ש״ח. כמה מטבעות של ${hi} ש״ח יש בקופה?`, big,
      [small, Math.floor(V / hi), big + 1, big - 1],
      `נניח שכל ${N} המטבעות הם של ${lo} ש״ח. אז היו בקופה ${N * lo} ש״ח, כלומר חסרים ${V - N * lo} ש״ח. כל החלפה של מטבע של ${lo} ש״ח במטבע של ${hi} ש״ח מוסיפה ${hi - lo} ש״ח, ולכן יש ${V - N * lo} ÷ ${hi - lo} = ${big} מטבעות של ${hi} ש״ח. בדיקה: ${big} × ${hi} + ${small} × ${lo} = ${V}.`,
      `(${V}-${lo}*${N})/(${hi}-${lo})`, undefined, { integer: true });
  },
  (rng) => {
    for (;;) {
      const f = rng.pick([2, 3]);
      const c = rng.int(3, 15);
      const x = rng.int(2, 12);
      const p = f * (c + x) - x;
      if (p < 22 || p > 60) continue;
      return q(rng, `אמא בת ${p} ובתה בת ${c}. בעוד כמה שנים תהיה האם מבוגרת מבתה פי ${f}?`, x,
        [p - f * c, x + 2, x * 2, Math.round(p / f) - c],
        `נסמן ב-x את מספר השנים. אז ${p} + x = ${f} × (${c} + x) = ${f * c} + ${f}x. מכאן ${p - f * c} = ${f - 1}x, כלומר x = ${x}. בדיקה: בעוד ${x} שנים האם תהיה בת ${p + x} והבת בת ${c + x}, ו-${p + x} = ${f} × ${c + x}.`,
        `(${p}-${f}*${c})/(${f}-1)`, undefined, { integer: true });
    }
  },
];

const TEMPLATES: Record<Difficulty, Template[]> = { easy, medium, hard };

export const wordProblemGenerator: QuestionGenerator = {
  id: 'word',
  topic: 'quantitative',
  subtopic: 'word-problem',
  build: (rng, difficulty) => rng.pick(TEMPLATES[difficulty])(rng),
};
