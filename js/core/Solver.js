// m24 - Solver.js
// INPUT-02：24 点求解器（分数运算 + AST 规范化去重）
// 依据：50-INPUT02-需求分析与求解算法设计.md（Manager 3 轮过审最终版）+ Manager 方案 X 决策
//   - 数值容器：分数 {num, den}（每步 gcd 化简；除以 0 返回 null 由上层过滤）
//   - 判为 24：num === 24*den && den !== 0
//   - 去重规则（Manager 5 条）：
//     1) AST 规范化：只对 + / * 节点按子树字典序排序子节点
//     2) - / / 节点保持原顺序
//     3) 多元 +/* 视为多参运算符（扁平化后排序哈希）
//     4) 不做跨运算符代数化简
//     5) 数值等价但结构不同视为不同解

// ============ 分数运算工具函数 ============

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

export function reduceFraction(frac) {
  const g = gcd(frac.num, frac.den);
  let num = frac.num / g;
  let den = frac.den / g;
  if (den < 0) { num = -num; den = -den; }
  return { num, den };
}

export function intToFraction(n) {
  return { num: n, den: 1 };
}

export function addFractions(a, b) {
  return reduceFraction({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
}

export function subtractFractions(a, b) {
  return reduceFraction({ num: a.num * b.den - b.num * a.den, den: a.den * b.den });
}

export function multiplyFractions(a, b) {
  return reduceFraction({ num: a.num * b.num, den: a.den * b.den });
}

export function divideFractions(a, b) {
  if (b.num === 0) return null;
  return reduceFraction({ num: a.num * b.den, den: a.den * b.num });
}

export function fractionsEqual(a, b) {
  return a.num * b.den === b.num * a.den;
}

export function is24(frac) {
  return frac.num === 24 * frac.den && frac.den !== 0;
}

// ============ 表达式树 ============
// 叶子:    { op: 'num', value: Fraction, label: string }
// 内部节点: { op: '+'|'-'|'*'|'/', args: [左, 右] }

function leaf(intValue) {
  return { op: 'num', value: intToFraction(intValue), label: String(intValue) };
}

// 扁平化 +/*：递归收集同类运算符下的所有非同类子节点
function flattenSameOp(node, op) {
  if (node.op !== op) return [node];
  const out = [];
  for (const k of node.args) {
    if (k.op === op) out.push(...flattenSameOp(k, op));
    else out.push(k);
  }
  return out;
}

// AST 规范化 key
export function toCanonicalKey(node) {
  if (node.op === 'num') {
    return `n${node.value.num}/${node.value.den}`;
  }
  const op = node.op;
  if (op === '+' || op === '*') {
    const flat = flattenSameOp(node, op).map(toCanonicalKey);
    flat.sort();
    return `(${op}|${flat.join('|')})`;
  }
  // - 或 /：保持顺序
  return `(${op}|${toCanonicalKey(node.args[0])}|${toCanonicalKey(node.args[1])})`;
}

export function normalizeExpression(exprNode) {
  return toCanonicalKey(exprNode);
}

// ============ 求解核心 ============

const OPS = ['+', '-', '*', '/'];

function combineOnce(a, b, op) {
  let value;
  switch (op) {
    case '+': value = addFractions(a.value, b.value); break;
    case '-': value = subtractFractions(a.value, b.value); break;
    case '*': value = multiplyFractions(a.value, b.value); break;
    case '/': {
      const v = divideFractions(a.value, b.value);
      if (v === null) return null;
      value = v;
      break;
    }
    default: return null;
  }
  const tree = { op, args: [a.tree, b.tree] };
  return { value, tree, expr: `(${a.expr}${op}${b.expr})` };
}

// 深度优先枚举：对每一对 (i,j) 且 i!==j，枚举 4 种运算符
// 交换律优化：+ 与 * 只算 i<j；- 与 / 需要 i,j 都遍历
function dfsAll(items, out, firstOnly, target) {
  if (firstOnly && out.length > 0) return;
  if (items.length === 1) {
    if (is24(items[0].value)) out.push(items[0]);
    return;
  }
  const n = items.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = [];
      for (let k = 0; k < n; k++) if (k !== i && k !== j) rest.push(items[k]);
      const a = items[i];
      const b = items[j];
      for (const op of OPS) {
        if ((op === '+' || op === '*') && i > j) continue;
        const merged = combineOnce(a, b, op);
        if (merged === null) continue;
        dfsAll([merged, ...rest], out, firstOnly, target);
        if (firstOnly && out.length > 0) return;
      }
    }
  }
}

export default class Solver {
  /**
   * 返回所有能算出 target（默认 24）的解法表达式字符串（去重后）
   * @param {number[]} numbers 4 个整数（含 0 表示大小王）
   * @param {number} target
   * @returns {string[]}
   */
  static findSolutions(numbers, target = 24) {
    const items = numbers.map((n) => ({
      value: intToFraction(n),
      tree: leaf(n),
      expr: String(n),
    }));
    const raw = [];
    dfsAll(items, raw, false, target);
    const seen = new Set();
    const uniq = [];
    for (const r of raw) {
      const key = toCanonicalKey(r.tree);
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(r.expr);
    }
    return uniq;
  }

  /**
   * 快速判定是否可解（找到 1 个即返回 true）
   * @param {number[]} numbers
   * @param {number} target
   * @returns {boolean}
   */
  static isSolvable(numbers, target = 24) {
    const items = numbers.map((n) => ({
      value: intToFraction(n),
      tree: leaf(n),
      expr: String(n),
    }));
    const out = [];
    dfsAll(items, out, true, target);
    return out.length > 0;
  }

  /** 兼容别名 */
  static hasSolution(numbers, target = 24) {
    return Solver.isSolvable(numbers, target);
  }

  /** 供 Tester 交叉验证：把表达式树规范化成 key */
  static normalize(exprNode) {
    return toCanonicalKey(exprNode);
  }

  // ============ INPUT-03 新增：用户表达式求值 API ============
  // 契约（Manager R-07 裁决 + Architect 60 号）：
  //   - 分母为 0 → 返回 { success:false, error:'division_by_zero' }
  //   - 求值成功 → 返回 { success:true, value: Fraction, is24: boolean }
  //   - 表达式非法 → 返回 { success:false, error:'invalid_expression', detail? }
  //   - 禁止返回 Infinity / NaN；禁止吞异常
  // 现有 findSolutions/isSolvable/hasSolution/normalize 字节不动。
  static evaluateExpression(tokens, cardValues) {
    try {
      return _evaluateTokens(tokens, cardValues);
    } catch (e) {
      if (e && e.__m24DivByZero) {
        return { success: false, error: 'division_by_zero' };
      }
      return { success: false, error: 'invalid_expression', detail: e && e.message };
    }
  }

  static is24Fraction(frac) {
    if (!frac) return false;
    return is24(frac);
  }
}

// ============ 私有：Shunting-yard + RPN 分数求值 ============
// Token 结构见 AnswerArea.js
//   { type:'number', cardIndex }
//   { type:'operator', value:'+'|'-'|'*'|'/' }
//   { type:'left_paren' } / { type:'right_paren' }
const _PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 };

function _tokensToRPN(tokens) {
  const output = [];
  const stack = [];
  for (const t of tokens) {
    if (t.type === 'number') {
      output.push(t);
    } else if (t.type === 'operator') {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type === 'operator' && _PRECEDENCE[top.value] >= _PRECEDENCE[t.value]) {
          output.push(stack.pop());
        } else break;
      }
      stack.push(t);
    } else if (t.type === 'left_paren') {
      stack.push(t);
    } else if (t.type === 'right_paren') {
      let popped = false;
      while (stack.length) {
        const top = stack.pop();
        if (top.type === 'left_paren') { popped = true; break; }
        output.push(top);
      }
      if (!popped) throw new Error('paren_mismatch');
    } else {
      throw new Error('unknown_token');
    }
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.type === 'left_paren') throw new Error('paren_mismatch');
    output.push(top);
  }
  return output;
}

function _evaluateTokens(tokens, cardValues) {
  if (!tokens || tokens.length === 0) throw new Error('empty');
  const rpn = _tokensToRPN(tokens);
  const stack = [];
  for (const t of rpn) {
    if (t.type === 'number') {
      const v = cardValues[t.cardIndex];
      if (typeof v !== 'number') throw new Error('invalid_card_index');
      stack.push(intToFraction(v));
    } else if (t.type === 'operator') {
      if (stack.length < 2) throw new Error('rpn_underflow');
      const b = stack.pop();
      const a = stack.pop();
      let r;
      switch (t.value) {
        case '+': r = addFractions(a, b); break;
        case '-': r = subtractFractions(a, b); break;
        case '*': r = multiplyFractions(a, b); break;
        case '/': {
          r = divideFractions(a, b);
          if (r === null) {
            const err = new Error('division_by_zero');
            err.__m24DivByZero = true;
            throw err;
          }
          break;
        }
        default: throw new Error('unknown_operator');
      }
      stack.push(r);
    } else {
      throw new Error('unexpected_token_in_rpn');
    }
  }
  if (stack.length !== 1) throw new Error('rpn_bad_result');
  const value = stack[0];
  return { success: true, value, is24: is24(value) };
}
