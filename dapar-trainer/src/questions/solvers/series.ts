import type { SeriesOp, SeriesRule } from '../types';

export function applyOp(x: number, op: SeriesOp): number {
  switch (op.op) {
    case '+':
      return x + op.v;
    case '-':
      return x - op.v;
    case '*':
      return x * op.v;
    case '/':
      return x / op.v;
  }
}

/** מחשב את n האיברים הראשונים של סדרה לפי החוקיות */
export function seriesTerms(rule: SeriesRule, start: number[], n: number): number[] {
  switch (rule.type) {
    case 'interleave': {
      const a = seriesTerms(rule.a, [start[0]], Math.ceil(n / 2));
      const b = seriesTerms(rule.b, [start[1]], Math.floor(n / 2));
      return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? a[i / 2] : b[(i - 1) / 2]));
    }
    case 'power':
      return Array.from({ length: n }, (_, i) => (rule.startN + i) ** rule.exp + rule.offset);
    case 'sumPrev': {
      const out = [start[0], start[1]];
      while (out.length < n) out.push(out[out.length - 1] + out[out.length - 2]);
      return out.slice(0, n);
    }
    default: {
      const out = [start[0]];
      for (let k = 0; out.length < n; k++) out.push(step(rule, out[out.length - 1], k));
      return out;
    }
  }
}

function step(rule: SeriesRule, x: number, k: number): number {
  switch (rule.type) {
    case 'add':
      return x + rule.d;
    case 'mul':
      return x * rule.r;
    case 'addInc':
      return x + rule.d + rule.inc * k;
    case 'mulAdd':
      return x * rule.m + rule.a;
    case 'cycle':
      return applyOp(x, rule.ops[k % rule.ops.length]);
    default:
      throw new Error(`step not defined for ${rule.type}`);
  }
}

/** פורמט הצגה של סדרה: "3, 7, 11, ?" */
export function formatSeries(terms: number[]): string {
  return [...terms.map((t) => String(t)), '?'].join(', ');
}
