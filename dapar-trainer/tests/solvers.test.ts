import { describe, expect, it } from 'vitest';
import { evaluateExpr } from '../src/questions/solvers/expr';
import { seriesTerms } from '../src/questions/solvers/series';

describe('evaluateExpr', () => {
  it('respects operator precedence', () => {
    expect(evaluateExpr('6+4*5')).toBe(26);
    expect(evaluateExpr('(6+4)*5')).toBe(50);
    expect(evaluateExpr('2^3^2')).toBe(512);
    expect(evaluateExpr('-3+10/4')).toBe(-0.5);
    expect(evaluateExpr('2*-3')).toBe(-6);
  });
  it('rejects garbage', () => {
    expect(() => evaluateExpr('2+')).toThrow();
    expect(() => evaluateExpr('alert(1)')).toThrow();
    expect(() => evaluateExpr('1/0')).toThrow();
  });
});

describe('seriesTerms', () => {
  it('computes each rule type', () => {
    expect(seriesTerms({ type: 'add', d: 4 }, [3], 5)).toEqual([3, 7, 11, 15, 19]);
    expect(seriesTerms({ type: 'mul', r: 3 }, [2], 4)).toEqual([2, 6, 18, 54]);
    expect(seriesTerms({ type: 'addInc', d: 1, inc: 1 }, [1], 6)).toEqual([1, 2, 4, 7, 11, 16]);
    expect(seriesTerms({ type: 'mulAdd', m: 2, a: 1 }, [3], 5)).toEqual([3, 7, 15, 31, 63]);
    expect(seriesTerms({ type: 'cycle', ops: [{ op: '+', v: 3 }, { op: '*', v: 2 }] }, [2], 6)).toEqual([2, 5, 10, 13, 26, 29]);
    expect(seriesTerms({ type: 'sumPrev' }, [2, 3], 7)).toEqual([2, 3, 5, 8, 13, 21, 34]);
    expect(seriesTerms({ type: 'power', exp: 2, offset: 0, startN: 1 }, [], 4)).toEqual([1, 4, 9, 16]);
    expect(
      seriesTerms({ type: 'interleave', a: { type: 'add', d: 3 }, b: { type: 'add', d: -4 } }, [5, 30], 7),
    ).toEqual([5, 30, 8, 26, 11, 22, 14]);
  });
});
