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
          // 方案 B（Architect 60 号修订版确定）：前置检查 b.num===0，命中则抛内部错误；
          // 不修改 divideFractions（保持 INPUT-02 字节零变化）
          if (b.num === 0) {
            const err = new Error('division_by_zero');
            err.__m24DivByZero = true;
            throw err;
          }
          r = divideFractions(a, b);
          if (r === null) {
            // 双保险：理论上上面已拦截；如果 divideFractions 因其它原因返 null也归一化为除零
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

// ============ INPUT-04 新增：AST 携带 + 后序步骤 + 字典序优先解 ============
// 依据：80-INPUT04-需求分析与设计.md §4 §5 §6
//   - findSolutionsWithAST：新 API，返回 [{ expr, ast }, ...] 去重后
//   - postOrderSteps：AST 后序遍历，产出 3 个中间步骤（op 用 ×/÷ 显示形式）
//   - chooseCanonicalSolution：确定性选优，字典序最小（无随机、无 Math.random）
//   - canonicalize：AST 规范化 key（与 toCanonicalKey 一致；此处提供 §10.2 约定的别名）
//   - 严格不修改现有 findSolutions/isSolvable/hasSolution/normalize/evaluateExpression 等既有 API

function _leafInternal(intValue) {
  return { op: 'num', value: intToFraction(intValue), label: String(intValue) };
}

// 内部符号 → 显示符号（*/÷ 与 ×÷）
function _displayOp(op) {
  if (op === '*') return '×';
  if (op === '/') return '÷';
  return op;
}

// 内部符号 → 字符串表达式（保持带外层括号；叶子为整数字符串）
function _renderNodeDisplay(node) {
  if (node.op === 'num') return node.label;
  return '(' + _renderNodeDisplay(node.args[0]) + _displayOp(node.op) + _renderNodeDisplay(node.args[1]) + ')';
}

function _evalNodeFrac(node) {
  if (node.op === 'num') return node.value;
  const a = _evalNodeFrac(node.args[0]);
  const b = _evalNodeFrac(node.args[1]);
  switch (node.op) {
    case '+': return addFractions(a, b);
    case '-': return subtractFractions(a, b);
    case '*': return multiplyFractions(a, b);
    case '/': {
      const v = divideFractions(a, b);
      if (v === null) throw new Error('postOrder: div_by_zero_in_valid_solution');
      return v;
    }
    default: throw new Error('postOrder: unknown_op ' + node.op);
  }
}

function _formatFrac(f) {
  if (!f) return '?';
  if (f.den === 1) return String(f.num);
  return `${f.num}/${f.den}`;
}

export function postOrderSteps(ast) {
  const steps = [];
  function traverse(node) {
    if (!node || node.op === 'num') return;
    traverse(node.args[0]);
    traverse(node.args[1]);
    // Bug2 修复：lhs/rhs 使用 pretty body（父 op = 当前节点 op；lhs 是左子，rhs 是右子）
    steps.push({
      step: steps.length + 1,
      lhs: _prettyBody(node.args[0], node.op, false),
      op: _displayOp(node.op),
      rhs: _prettyBody(node.args[1], node.op, true),
      result: _formatFrac(_evalNodeFrac(node)),
    });
  }
  traverse(ast);
  return steps;
}

// 字典序最小策略（§5）
//   - solutions: [{ expr, ast }, ...] 或 字符串数组
//   - cards: 保留参数（未来扩展），当前不使用
// 返回：单个 Solution 对象（同类型输入元素）
export function chooseCanonicalSolution(solutions, _cards) {
  if (!solutions || solutions.length === 0) return null;
  const isObj = typeof solutions[0] === 'object' && solutions[0] !== null;
  let best = solutions[0];
  let bestExpr = isObj ? best.expr : best;
  for (let i = 1; i < solutions.length; i++) {
    const cur = solutions[i];
    const curExpr = isObj ? cur.expr : cur;
    if (curExpr < bestExpr) {
      best = cur;
      bestExpr = curExpr;
    }
  }
  return best;
}

export function canonicalize(ast) {
  // Bug1 修复：使用 v2 canonicalize（+/- 符号项归一 + 减号 push down）
  return toCanonicalKeyV2(ast);
}

// findSolutionsWithAST：新 API，独立函数 + 挂到 Solver 上
function _findSolutionsWithASTImpl(numbers, target = 24) {
  const items = numbers.map((n) => ({
    value: intToFraction(n),
    tree: _leafInternal(n),
    expr: String(n),
  }));
  const raw = [];
  dfsAll(items, raw, false, target);
  const seen = new Map(); // key -> uniq[] index
  const uniq = [];
  const _hasDivOne = (expr) => expr.indexOf('/1') !== -1;
  for (const r of raw) {
    // Bug1 修复：使用 v2 canonicalize（+/- 符号项归一 + 减号 push down）
    // Bug5.1: toCanonicalKeyV2 内部会先运行 _normalizeOneMulDiv 将 a÷1 归一为 a×1
    const key = toCanonicalKeyV2(r.tree);
    if (seen.has(key)) {
      // Bug5.1: 同 key 碰撞时，优先保留 expr 中不含 "/1" 的变体（UI 仅显示 ×1）
      const prevIdx = seen.get(key);
      const prev = uniq[prevIdx];
      const prevBad = _hasDivOne(prev.expr);
      const curBad = _hasDivOne(r.expr);
      if (prevBad && !curBad) {
        // 当前候选更差，替换为新候选
        uniq[prevIdx] = { expr: r.expr, ast: r.tree, key };
      } else if (prevBad === curBad && r.expr < prev.expr) {
        // 同质量，取字典序更小的
        uniq[prevIdx] = { expr: r.expr, ast: r.tree, key };
      }
      continue;
    }
    seen.set(key, uniq.length);
    uniq.push({ expr: r.expr, ast: r.tree, key });
  }
  // 确定性排序：按 expr 字典序（无随机、无 Object.keys 依赖插入顺序）
  uniq.sort((a, b) => (a.expr < b.expr ? -1 : a.expr > b.expr ? 1 : 0));
  return uniq;
}

export function findSolutionsWithAST(numbers, target = 24) {
  return _findSolutionsWithASTImpl(numbers, target);
}

// 把 INPUT-04 新增 API 挂到 Solver 类上（不修改类体，字节仍在原位）
Solver.findSolutionsWithAST = _findSolutionsWithASTImpl;
Solver.postOrderSteps = postOrderSteps;
Solver.chooseCanonicalSolution = chooseCanonicalSolution;
Solver.canonicalize = canonicalize;

// ============ INPUT-04 bugfix：Bug1 + Bug2 新增函数（追加末尾） ============
// 依据：87-INPUT04-bugfix-分析与修复方案.md §1.4 §2.2
// - toCanonicalKeyV2 / _flattenSignedAdditiveTerms：加减链符号项归一 + 减号 push down
//   规则 G1~G5，硬约束：不代数化简；乘除层保持 v1 语义（* 排序、/ 保序）
// - formatExprPretty / _prettyBody：显示层去多余括号（优先级 + 结合性），
//   仅供 GameCore 显示出口调用；Solver 内部（combineOnce/expr 排序）不受影响

function _flattenSignedAdditiveTerms(node, entrySign) {
  const flip = (s) => (s === '+' ? '-' : '+');
  if (node.op === 'num') {
    return [{ sign: entrySign, key: _toCanonicalKeyV2Raw(node) }];
  }
  if (node.op === '+') {
    return [
      ..._flattenSignedAdditiveTerms(node.args[0], entrySign),
      ..._flattenSignedAdditiveTerms(node.args[1], entrySign),
    ];
  }
  if (node.op === '-') {
    return [
      ..._flattenSignedAdditiveTerms(node.args[0], entrySign),
      ..._flattenSignedAdditiveTerms(node.args[1], flip(entrySign)),
    ];
  }
  // 非 +/- 子树整体作为一个 term（× / ÷ 子树 / 叶子已在上面）
  return [{ sign: entrySign, key: _toCanonicalKeyV2Raw(node) }];
}

export function toCanonicalKeyV2(node) {
  // Bug5.1 (v2): 在生成 key 前先将 a÷1 / 1×a 深度改写为 a×1，使 a×1 ≡ a÷1（仅当另一侧为整数 1 时）
  // 硬约束：不代数化简（a×1 仍为 a×1，不完全变为 a）；1÷a 不改写（值为 1/a ≠ a）
  return _toCanonicalKeyV2Raw(_normalizeOneMulDiv(node));
}

// Bug5.1: 前置改写 pass（仅与整数 1 相乘或相除时触发）
function _normalizeOneMulDiv(node) {
  if (!node || node.op === 'num') return node;
  // 深度优先归一
  const l = _normalizeOneMulDiv(node.args[0]);
  const r = _normalizeOneMulDiv(node.args[1]);
  const isOne = (x) => x && x.op === 'num' && x.value && x.value.num === 1 && x.value.den === 1;
  if (node.op === '*' || node.op === '/') {
    if (isOne(r)) {
      // a×1 和 a÷1 都归一为 a×1
      return { op: '*', args: [l, r] };
    }
    if (isOne(l)) {
      if (node.op === '*') {
        // 1×a → a×1（交换）
        return { op: '*', args: [r, l] };
      }
      // 1÷a 不改写（值为 1/a）
      return { op: node.op, args: [l, r] };
    }
  }
  // 其他情形：直接重建子树（子树已深度归一）
  return { op: node.op, args: [l, r] };
}

function _toCanonicalKeyV2Raw(node) {
  if (node.op === 'num') {
    return `n${node.value.num}/${node.value.den}`;
  }
  // × ：沿用 v1 排序语义（交换律）
  if (node.op === '*') {
    const flat = flattenSameOp(node, '*').map(_toCanonicalKeyV2Raw);
    flat.sort();
    return `(*|${flat.join('|')})`;
  }
  // ÷ ：保序不变（硬约束：不做 a÷(b×c) ≡ (a÷b)÷c）
  if (node.op === '/') {
    return `(/|${_toCanonicalKeyV2Raw(node.args[0])}|${_toCanonicalKeyV2Raw(node.args[1])})`;
  }
  // +/-：符号项化 + push down 后按 (sign, key) 排序
  if (node.op === '+' || node.op === '-') {
    const terms = _flattenSignedAdditiveTerms(node, '+');
    terms.sort((a, b) => {
      if (a.key !== b.key) return a.key < b.key ? -1 : 1;
      return a.sign < b.sign ? -1 : (a.sign > b.sign ? 1 : 0);
    });
    return `(+chain|${terms.map((t) => t.sign + t.key).join('|')})`;
  }
  throw new Error('toCanonicalKeyV2: unknown op ' + node.op);
}

Solver.toCanonicalKeyV2 = toCanonicalKeyV2;

// -------- Bug2: formatExprPretty --------

const _PRETTY_PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '×': 2, '÷': 2 };

function _prettyBody(node, parentOp, isRightChild) {
  if (!node) return '';
  if (node.op === 'num') return node.label;

  const leftStr = _prettyBody(node.args[0], node.op, false);
  const rightStr = _prettyBody(node.args[1], node.op, true);
  const inner = leftStr + _displayOp(node.op) + rightStr;

  if (parentOp === null || parentOp === undefined) return inner; // R1：最外层

  const pP = _PRETTY_PRECEDENCE[parentOp];
  const pC = _PRETTY_PRECEDENCE[node.op];

  if (pC > pP) return inner;              // R3-a：子优先级高，无括号
  if (pC < pP) return '(' + inner + ')';  // R3-b：子优先级低，必括号

  // 同优先级
  if (!isRightChild) return inner;                        // R3-c：左子（左结合）
  if (parentOp === '+' || parentOp === '*') return inner; // R3-d1：右子 & 父 + 或 ×（结合律）
  return '(' + inner + ')';                               // R3-d2：右子 & 父 - 或 ÷
}

export function formatExprPretty(ast) {
  if (!ast || ast.op === undefined) return String(ast || '');
  if (ast.op === 'num') return ast.label;
  return _prettyBody(ast, null, false);
}

Solver.formatExprPretty = formatExprPretty;
Solver._prettyBody = _prettyBody; // 供测试与内部 postOrderSteps 使用
