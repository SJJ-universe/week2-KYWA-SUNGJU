// Client-side safe expression evaluator.
// Mirrors backend/app.py AST whitelist exactly: + - * / // % ** unary +/-, parentheses, numeric literals.
// No eval, no Function constructor.

export class CalcError extends Error {}

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c >= '0' && c <= '9' || c === '.') {
      let j = i;
      let dot = c === '.';
      while (j + 1 < s.length) {
        const n = s[j + 1];
        if (n >= '0' && n <= '9') { j++; continue; }
        if (n === '.' && !dot) { dot = true; j++; continue; }
        break;
      }
      const numStr = s.slice(i, j + 1);
      const num = Number(numStr);
      if (!Number.isFinite(num)) throw new CalcError('잘못된 숫자');
      tokens.push({ type: 'num', value: num });
      i = j + 1;
      continue;
    }
    if (c === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (c === '+' || c === '-' || c === '%') {
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }
    if (c === '*') {
      if (s[i + 1] === '*') { tokens.push({ type: 'op', value: '**' }); i += 2; }
      else { tokens.push({ type: 'op', value: '*' }); i++; }
      continue;
    }
    if (c === '/') {
      if (s[i + 1] === '/') { tokens.push({ type: 'op', value: '//' }); i += 2; }
      else { tokens.push({ type: 'op', value: '/' }); i++; }
      continue;
    }
    throw new CalcError(`허용되지 않는 문자: ${c}`);
  }
  return tokens;
}

// Recursive-descent parser
// expr   = term (('+'|'-') term)*
// term   = factor (('*'|'/'|'//'|'%') factor)*
// factor = unary ('**' factor)?     // right-assoc
// unary  = ('+'|'-') unary | atom
// atom   = NUM | '(' expr ')'

class Parser {
  pos = 0;
  constructor(private toks: Token[]) {}

  peek(): Token | undefined { return this.toks[this.pos]; }
  consume(): Token { return this.toks[this.pos++]; }

  parseExpr(): number {
    let left = this.parseTerm();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.consume();
        const right = this.parseTerm();
        left = t.value === '+' ? left + right : left - right;
      } else break;
    }
    return left;
  }

  parseTerm(): number {
    let left = this.parseFactor();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/' || t.value === '//' || t.value === '%')) {
        this.consume();
        const right = this.parseFactor();
        if ((t.value === '/' || t.value === '//' || t.value === '%') && right === 0) {
          throw new CalcError('0으로 나눌 수 없음');
        }
        switch (t.value) {
          case '*': left = left * right; break;
          case '/': left = left / right; break;
          case '//': left = Math.floor(left / right); break;
          case '%': left = left - Math.floor(left / right) * right; break;
        }
      } else break;
    }
    return left;
  }

  parseFactor(): number {
    const left = this.parseUnary();
    const t = this.peek();
    if (t && t.type === 'op' && t.value === '**') {
      this.consume();
      const right = this.parseFactor();
      return Math.pow(left, right);
    }
    return left;
  }

  parseUnary(): number {
    const t = this.peek();
    if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
      this.consume();
      const v = this.parseUnary();
      return t.value === '+' ? +v : -v;
    }
    return this.parseAtom();
  }

  parseAtom(): number {
    const t = this.peek();
    if (!t) throw new CalcError('식이 비어 있습니다');
    if (t.type === 'num') { this.consume(); return t.value; }
    if (t.type === 'lparen') {
      this.consume();
      const v = this.parseExpr();
      const close = this.peek();
      if (!close || close.type !== 'rparen') throw new CalcError("')' 가 필요합니다");
      this.consume();
      return v;
    }
    throw new CalcError('문법 오류');
  }
}

export function safeCalc(expression: string): number {
  if (typeof expression !== 'string') throw new CalcError('문자열이어야 합니다');
  if (expression.length > 200) throw new CalcError('식이 너무 깁니다');
  if (!expression.trim()) throw new CalcError('식이 비어 있습니다');
  const toks = tokenize(expression);
  const parser = new Parser(toks);
  const result = parser.parseExpr();
  if (parser.pos !== toks.length) throw new CalcError('문법 오류');
  if (!Number.isFinite(result)) throw new CalcError('결과가 유효하지 않음');
  return result;
}
