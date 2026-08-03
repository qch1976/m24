// m24 - RecipParser.js
// INPUT-06：递归下降 parser（前置校验器 + AST 构造器）
// 依据：INPUT-06.md §1.2.2 + 170-INPUT06-Architect方案.md §4
//
// 设计决策：Solver.js 的 Shunting-yard 保留字节不动（R-09 保护 INPUT-05 回归）；
//   本 parser 作为「1/x 语义校验 + AST 构造」的独立前置层。
//
// grammar（仅 1 条新规则）：
//   expr      := term (('+' | '-') term)*
//   term      := unary (('*' | '/') unary)*
//   unary     := 'RECIP' atomLeaf        ← ★ 唯一新增；走 atomLeaf 而非 atom
//              | atom
//   atomLeaf  := '(' atomLeaf ')'        ← 冗余括号递归剥离，不误伤 1/(3) 1/((3))
//              | NUMBER                  ← 只能落到数字叶子
//   atom      := '(' expr ')' | NUMBER
//
// atomLeaf 分支即实现 §1.2.2「1/x 子节点必须是数字叶子」，
// 任何运算符出现在 RECIP 操作数内即报 recip_operand_not_leaf。

import { numLeaf, recipLeaf, F, addF, subF, mulF, divF, is24F, countRecip } from './RecipSolver';

export const ERR = {
  RECIP_OPERAND_NOT_LEAF: 'recip_operand_not_leaf',
  RECIP_DANGLING: 'recip_dangling',
  PAREN_MISMATCH: 'paren_mismatch',
  UNEXPECTED_TOKEN: 'unexpected_token',
  UNEXPECTED_END: 'unexpected_end',
  TRAILING_TOKEN: 'trailing_token',
  EMPTY: 'empty',
  CARD_REUSED: 'card_reused',
  DIVISION_BY_ZERO: 'division_by_zero',
};

export const ERR_MSG = {
  [ERR.RECIP_OPERAND_NOT_LEAF]: '倒数只能作用于牌面数字',
  [ERR.RECIP_DANGLING]: '倒数后需要一个数字',
  [ERR.PAREN_MISMATCH]: '括号不匹配',
  [ERR.UNEXPECTED_TOKEN]: '算式格式不正确',
  [ERR.UNEXPECTED_END]: '算式不完整',
  [ERR.TRAILING_TOKEN]: '算式格式不正确',
  [ERR.EMPTY]: '请先输入算式',
  [ERR.CARD_REUSED]: '每张牌只能用一次',
  [ERR.DIVISION_BY_ZERO]: '算式包含除零，无法求值',
};

function fail(code, detail) {
  const e = new Error(code);
  e.__m24Parse = true;
  e.code = code;
  if (detail !== undefined) e.detail = detail;
  throw e;
}

// ============ Parser 主体 ============
// token 形态（沿用 AnswerArea.TokenType，追加 recip）：
//   { type:'number', cardIndex }
//   { type:'operator', value:'+'|'-'|'*'|'/' }
//   { type:'left_paren' } / { type:'right_paren' }
//   { type:'recip' }                              ← ★ INPUT-06 新增

class P {
  constructor(tokens, cardValues) {
    this.ts = tokens || [];
    this.cv = cardValues || [];
    this.i = 0;
  }

  peek() { return this.i < this.ts.length ? this.ts[this.i] : null; }
  next() { return this.i < this.ts.length ? this.ts[this.i++] : null; }

  isOp(v) {
    const t = this.peek();
    return !!t && t.type === 'operator' && t.value === v;
  }

  // expr := term (('+'|'-') term)*
  expr() {
    let node = this.term();
    for (;;) {
      if (this.isOp('+') || this.isOp('-')) {
        const op = this.next().value;
        const rhs = this.term();
        node = { op, a: node, b: rhs };
      } else break;
    }
    return node;
  }

  // term := unary (('*'|'/') unary)*
  term() {
    let node = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = this.next().value;
        const rhs = this.unary();
        node = { op, a: node, b: rhs };
      } else break;
    }
    return node;
  }

  // unary := 'RECIP' atomLeaf | atom
  unary() {
    const t = this.peek();
    if (t && t.type === 'recip') {
      this.next();
      const nxt = this.peek();
      if (!nxt) fail(ERR.RECIP_DANGLING);
      if (nxt.type === 'operator') fail(ERR.RECIP_DANGLING);
      const leaf = this.atomLeaf(); // ★ 只接受叶子（含冗余括号）
      return recipLeaf(leaf.card, leaf.slot);
    }
    return this.atom();
  }

  // atomLeaf := '(' atomLeaf ')' | NUMBER
  // ★ 实测踩坑修正：括号内下一个 token 不是 ')' 时必须抛 recip_operand_not_leaf，
  //   而非通用 paren_mismatch —— 否则 1/(1-3/4) 会报「括号不匹配」误导用户
  atomLeaf() {
    const t = this.next();
    if (!t) fail(ERR.RECIP_DANGLING);
    if (t.type === 'left_paren') {
      const inner = this.atomLeaf();
      const cl = this.peek();
      if (!cl || cl.type !== 'right_paren') fail(ERR.RECIP_OPERAND_NOT_LEAF);
      this.next();
      return inner;
    }
    if (t.type === 'number') return this.mkNum(t);
    fail(ERR.RECIP_OPERAND_NOT_LEAF);
    return null;
  }

  // atom := '(' expr ')' | NUMBER
  atom() {
    const t = this.next();
    if (!t) fail(ERR.UNEXPECTED_END);
    if (t.type === 'left_paren') {
      const inner = this.expr();
      const cl = this.peek();
      if (!cl || cl.type !== 'right_paren') fail(ERR.PAREN_MISMATCH);
      this.next();
      return inner;
    }
    if (t.type === 'number') return this.mkNum(t);
    if (t.type === 'right_paren') fail(ERR.PAREN_MISMATCH);
    fail(ERR.UNEXPECTED_TOKEN, t.type);
    return null;
  }

  mkNum(t) {
    const v = this.cv[t.cardIndex];
    if (typeof v !== 'number') fail(ERR.UNEXPECTED_TOKEN, 'invalid_card_index');
    return numLeaf(v, t.cardIndex);
  }
}

/**
 * 解析 token 序列为 AST。
 * @returns {{ ok:true, ast:Node } | { ok:false, error:string, message:string, detail?:any }}
 */
export function parse(tokens, cardValues) {
  if (!tokens || tokens.length === 0) {
    return { ok: false, error: ERR.EMPTY, message: ERR_MSG[ERR.EMPTY] };
  }
  try {
    const p = new P(tokens, cardValues);
    const ast = p.expr();
    if (p.i !== p.ts.length) {
      const rest = p.ts[p.i];
      const code = rest && rest.type === 'right_paren' ? ERR.PAREN_MISMATCH : ERR.TRAILING_TOKEN;
      return { ok: false, error: code, message: ERR_MSG[code] };
    }
    return { ok: true, ast };
  } catch (e) {
    if (e && e.__m24Parse) {
      return { ok: false, error: e.code, message: ERR_MSG[e.code] || ERR_MSG[ERR.UNEXPECTED_TOKEN], detail: e.detail };
    }
    return { ok: false, error: ERR.UNEXPECTED_TOKEN, message: ERR_MSG[ERR.UNEXPECTED_TOKEN], detail: e && e.message };
  }
}

// AST 精确求值（Fraction，禁浮点）
export function evalAst(ast) {
  if (!ast) return { ok: false, error: ERR.EMPTY };
  let divZero = false;
  const rec = (t) => {
    if (divZero) return null;
    if (t.op === 'num') return F(t.card);
    if (t.op === 'recip') {
      if (t.arg.card === 0) { divZero = true; return null; }
      return F(1, t.arg.card);
    }
    const a = rec(t.a);
    const b = rec(t.b);
    if (a === null || b === null) return null;
    switch (t.op) {
      case '+': return addF(a, b);
      case '-': return subF(a, b);
      case '*': return mulF(a, b);
      case '/': {
        if (b.n === 0n) { divZero = true; return null; }
        return divF(a, b);
      }
      default: return null;
    }
  };
  const v = rec(ast);
  if (divZero || v === null) {
    return { ok: false, error: ERR.DIVISION_BY_ZERO, message: ERR_MSG[ERR.DIVISION_BY_ZERO] };
  }
  return { ok: true, value: v, is24: is24F(v) };
}

/**
 * 用户答题一站式判定（parser + 独立 evaluator）。
 * @param {object[]} tokens
 * @param {number[]} cardValues
 * @param {{ advancedCalc?:boolean }} [opts]
 * @returns {object}
 */
export function checkUserAnswer(tokens, cardValues, opts) {
  const advancedCalc = !!(opts && opts.advancedCalc);
  // 高级计算关闭时不允许出现 recip token（开关关闭 = INPUT-05 计算行为）
  if (!advancedCalc && (tokens || []).some((t) => t && t.type === 'recip')) {
    return { pass: false, reason: ERR.UNEXPECTED_TOKEN, message: '请先在设置中开启「高级计算」' };
  }
  const pr = parse(tokens, cardValues);
  if (!pr.ok) {
    return { pass: false, reason: pr.error, message: pr.message, invalid: true };
  }
  // 4 张牌各用一次
  const slots = [];
  const walk = (t) => {
    if (t.op === 'num') { slots.push(t.slot); return; }
    if (t.op === 'recip') { slots.push(t.arg.slot); return; }
    walk(t.a); walk(t.b);
  };
  walk(pr.ast);
  if (slots.length !== 4 || new Set(slots).size !== 4) {
    return { pass: false, reason: ERR.CARD_REUSED, message: ERR_MSG[ERR.CARD_REUSED], invalid: true };
  }
  const ev = evalAst(pr.ast);
  if (!ev.ok) {
    return { pass: false, reason: ev.error, message: ev.message, invalid: true };
  }
  // usedRecip：1/1 不计（§4.7 + R-04.1）；此处看原式（用户输入路径的"是否用了高级符号"标记）
  const usedRecip = countRecip(pr.ast) > 0;
  if (ev.is24) {
    return { pass: true, ast: pr.ast, value: ev.value, usedRecip };
  }
  const label = ev.value.d === 1n ? String(ev.value.n) : `${ev.value.n}/${ev.value.d}`;
  return { pass: false, reason: 'not_24', actualLabel: label, value: ev.value, usedRecip };
}

export default { parse, evalAst, checkUserAnswer, ERR, ERR_MSG };
