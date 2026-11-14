import { formatNumber } from '../lib/format';
import { cellKey } from './matrices/model';
import { solveMatrix } from './matrices/solver';
import { evaluateExpr } from './solvers/expr';
import { matchAnswer, solveInstruction } from './solvers/instructions';
import { formatSeries, seriesTerms } from './solvers/series';
import { CHOICE_IDS, type Choice, type Content, type Question, type VerifySpec } from './types';

const EPS = 1e-6;

/** מחשב מחדש את התשובה הנכונה מתוך מפרט אימות מספרי */
export function computeVerifiedAnswer(v: VerifySpec): number {
  if (v.kind === 'expr') return evaluateExpr(v.expr);
  if (v.kind === 'series') return seriesTerms(v.rule, v.start, v.shown + 1)[v.shown];
  throw new Error(`not a numeric verify spec: ${v.kind}`);
}

export function contentKey(c: Content): string {
  if (c.kind === 'text') return c.text.trim();
  return c.figure.type === 'cell' ? `cell:${cellKey(c.figure.cell)}` : 'matrix';
}

export function contentText(c: Content): string {
  return c.kind === 'text' ? c.text : c.alt;
}

export function choiceValue(c: Choice): number | undefined {
  if (c.value !== undefined) return c.value;
  const m = /-?\d+(\.\d+)?/.exec(contentText(c.content));
  return m ? parseFloat(m[0]) : undefined;
}

/** מחזיר רשימת שגיאות (ריקה = השאלה תקינה) */
export function validateQuestion(q: Question): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`[${q.id}] ${m}`);

  if (!q.id) err('missing id');
  if (q.prompt.length === 0 || q.prompt.every((p) => !contentText(p).trim())) err('empty prompt');
  if (!q.explanation || q.explanation.trim().length < 15) err('explanation too short');

  if (q.choices.length !== 4) err(`expected 4 choices, got ${q.choices.length}`);
  const ids = q.choices.map((c) => c.id);
  if (CHOICE_IDS.some((id) => !ids.includes(id))) err('choice ids must be a,b,c,d');
  const keys = q.choices.map((c) => contentKey(c.content));
  if (new Set(keys).size !== keys.length) err(`duplicate choices: ${keys.join(' | ')}`);
  if (keys.some((t) => !t)) err('empty choice');

  const correct = q.choices.find((c) => c.id === q.correctChoiceId);
  if (!correct) {
    err(`correctChoiceId ${q.correctChoiceId} not found`);
    return errors;
  }
  if (!q.verify) return errors;

  try {
    switch (q.verify.kind) {
      case 'expr':
      case 'series':
        validateNumeric(q, q.verify, correct, err);
        break;
      case 'matrix':
        validateMatrix(q, err);
        break;
      case 'instructions':
        validateInstructions(q, err);
        break;
    }
  } catch (e) {
    err(`verify failed: ${(e as Error).message}`);
  }
  return errors;
}

function validateNumeric(q: Question, v: Extract<VerifySpec, { kind: 'expr' | 'series' }>, correct: Choice, err: (m: string) => void) {
  const answer = computeVerifiedAnswer(v);
  if (!Number.isFinite(answer)) err(`verified answer is not finite: ${answer}`);

  const values = q.choices.map(choiceValue);
  if (values.some((x) => x === undefined)) err('every choice needs a numeric value');
  const matching = q.choices.filter((_, i) => values[i] !== undefined && Math.abs(values[i]! - answer) < EPS);
  if (matching.length !== 1) {
    err(`expected exactly 1 choice equal to ${answer}, found ${matching.length}`);
  } else if (matching[0].id !== q.correctChoiceId) {
    err(`marked answer ${q.correctChoiceId} but computed answer ${formatNumber(answer)} is choice ${matching[0].id}`);
  }
  const numericValues = values.filter((x): x is number => x !== undefined).map((x) => Math.round(x / EPS));
  if (new Set(numericValues).size !== numericValues.length) err('two choices share the same numeric value');

  // ההסבר חייב להזכיר את התשובה הנכונה (תופס הסברים שלא תואמים לתשובה)
  const text = contentText(correct.content);
  if (!q.explanation.includes(text) && !q.explanation.includes(formatNumber(answer))) {
    err(`explanation does not mention the answer (${text})`);
  }

  if (v.kind === 'series') {
    const expected = formatSeries(seriesTerms(v.rule, v.start, v.shown));
    if (!q.prompt.some((p) => p.kind === 'text' && p.text.trim() === expected)) err(`series prompt should contain "${expected}"`);
  }
}

function validateMatrix(q: Question, err: (m: string) => void) {
  const fig = q.prompt.find((p) => p.kind === 'figure' && p.figure.type === 'matrix');
  if (!fig || fig.kind !== 'figure' || fig.figure.type !== 'matrix') {
    err('matrix question without a matrix figure');
    return;
  }
  const sol = solveMatrix(fig.figure.cells);
  if (!sol.cell) {
    err(`matrix is not unambiguous (ambiguous: ${sol.ambiguousAttrs.join(',')}; unsolved: ${sol.unsolvedAttrs.join(',')})`);
    return;
  }
  const key = cellKey(sol.cell);
  const matching = q.choices.filter((c) => c.content.kind === 'figure' && c.content.figure.type === 'cell' && cellKey(c.content.figure.cell) === key);
  if (matching.length !== 1) err(`expected exactly 1 choice matching the solved cell, found ${matching.length}`);
  else if (matching[0].id !== q.correctChoiceId) err(`solver picked ${matching[0].id}, marked ${q.correctChoiceId}`);
}

function validateInstructions(q: Question, err: (m: string) => void) {
  if (q.verify?.kind !== 'instructions') return;
  if (!q.passage) {
    err('instructions question without a passage');
    return;
  }
  const query = q.verify.query;
  const answer = solveInstruction(q.passage.spec, query);
  const matching = q.choices.filter((c, i) => matchAnswer(answer, c, i));
  if (matching.length !== 1) err(`expected exactly 1 choice matching solver answer ${JSON.stringify(answer)}, found ${matching.length}`);
  else if (matching[0].id !== q.correctChoiceId) err(`solver picked ${matching[0].id}, marked ${q.correctChoiceId}`);

  // הנתונים שהפותר משתמש בהם חייבים להופיע בטקסט שהנבחן רואה
  if ('candidates' in query) {
    // כל מועמד מופיע בשורה משלו, וכל ערך מספרי שלו חייב להופיע באותה שורה
    const lines = q.prompt.map(contentText);
    for (const c of query.candidates) {
      const line = lines.find((t) => t.startsWith(c.name + ':') || t.includes(` ${c.name}:`));
      if (!line) {
        err(`candidate ${c.name} not shown in prompt`);
        continue;
      }
      for (const [k, v] of Object.entries(c.attrs)) {
        if (typeof v === 'number' && !new RegExp(`(^|[^\\d])${v}([^\\d]|$)`).test(line)) err(`value ${k}=${v} of ${c.name} not shown in its line`);
      }
    }
  }
}
