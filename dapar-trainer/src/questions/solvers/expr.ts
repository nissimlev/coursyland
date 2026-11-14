/**
 * מחשבון ביטויים בטוח (בלי eval) לאימות שאלות כמותיות.
 * תומך ב: מספרים עשרוניים, + - * / ^, סוגריים ומינוס אונרי.
 */
export function evaluateExpr(source: string): number {
  const s = source.replace(/\s+/g, '');
  let pos = 0;

  const peek = () => s[pos];
  const fail = (msg: string): never => {
    throw new Error(`${msg} at ${pos} in "${source}"`);
  };

  function parseExpression(): number {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = s[pos++];
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = s[pos++];
      const rhs = parseFactor();
      if (op === '/' && rhs === 0) fail('division by zero');
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseFactor(): number {
    const base = parseUnary();
    if (peek() === '^') {
      pos++;
      return base ** parseFactor(); // אסוציאטיבי מימין
    }
    return base;
  }

  function parseUnary(): number {
    if (peek() === '-') {
      pos++;
      return -parseUnary();
    }
    if (peek() === '+') {
      pos++;
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    if (peek() === '(') {
      pos++;
      const v = parseExpression();
      if (peek() !== ')') fail('expected )');
      pos++;
      return v;
    }
    const m = /^\d+(\.\d+)?/.exec(s.slice(pos));
    if (!m) fail('expected number');
    pos += m![0].length;
    return parseFloat(m![0]);
  }

  const result = parseExpression();
  if (pos !== s.length) fail('unexpected character');
  return result;
}
