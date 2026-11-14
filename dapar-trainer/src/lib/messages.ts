export const CORRECT_MESSAGES = ['מעולה!', 'בול!', 'יפה מאוד!', 'נכון!', 'אלופים!', 'בדיוק ככה!', 'כל הכבוד!'];

export const WRONG_MESSAGES = [
  'לא נורא, מכאן לומדים.',
  'כמעט! כדאי לקרוא את ההסבר.',
  'טעות היא חלק מהתרגול.',
  'לא הפעם, אבל ההסבר יעזור בפעם הבאה.',
  'קורה לכולם. הנה איך פותרים:',
];

export const TIMEOUT_MESSAGES = ['הזמן נגמר. הנה הפתרון:', 'נגמר הזמן. בפעם הבאה זה ילך מהר יותר.'];

export function randomOf(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function summaryMessage(pct: number): string {
  if (pct >= 90) return 'ביצוע מצוין! שליטה מלאה בחומר.';
  if (pct >= 75) return 'עבודה טובה מאוד, עוד קצת וזה מושלם.';
  if (pct >= 55) return 'התקדמות יפה. כדאי לעבור על הטעויות.';
  return 'בשביל זה מתרגלים. כדאי לעבור על ההסברים ולנסות שוב.';
}
