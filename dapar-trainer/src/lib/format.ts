/** מספר עם עד 2 ספרות אחרי הנקודה, בלי אפסים מיותרים */
export function formatNumber(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

/** טקסט שכולו מספרים וסימנים מתמטיים: יוצג LTR כדי שלא יתהפך (למשל מינוס או שבר) */
export function isMathText(t: string): boolean {
  return /^[\d\s.,:/%+\-−×÷?²³⁵()=]+$/.test(t);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} שנ׳`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')} דק׳`;
}

export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}
