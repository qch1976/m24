// m24 - RecipParser.js
// INPUT-06：递归下降 parser（前置校验器 + AST 构造器）
// 依据：INPUT-06.md §1.2.2 + 170-INPUT06-Architect方案.md §4
//
// 设计决策：Solver.js 的 Shunting-yard 保留字节不动（R-09 保护 INPUT-05 回归）；
//   本 parser 作为「1/x 语义校验 + AST 构造」的独立前置层。
//
// grammar（INPUT-06 1 条 + INPUT-07 2 条）：
//   expr      := term (('+' | '-') term)*
//   term      := modish (('*' | '/') modish)*
//   modish    := unary ('%' unary)?          ← ★ INPUT-07；不可链式 ⇒ (7%3)%2 天然拒收
//   unary     := 'RECIP' atomLeaf            ← ★ INPUT-06；走 atomLeaf 而非 atom
//              | postfix
//   postfix   := atom '!'*                   ← ★ INPUT-07；'!' 后缀，限叶子由 mkFact 校验
//   atomLeaf  := '(' atomLeaf ')'            ← 冗余括号递归剥离，不误伤 1/(3) 1/((3))
//              | NUMBER
//   atom      := '(' expr ')' | NUMBER
//
// atomLeaf 分支即实现 §1.2.2「1/x 子节点必须是数字叶子」，
// 任何运算符出现在 RECIP 操作数内即报 recip_operand_not_leaf。
//
// 🔴 INPUT-07 §1.5【修饰不可叠加通则】（项目主 2026-08-06 13:07 裁定）：
//    任一高级符号不得作用于另一高级符号的输出（带修饰的叶子不再是叶子）。
//    实现：单一判据 isRawLeaf()，覆盖 9 行禁止矩阵（§1.5.2），不写 9 个特判。
import {
  numLeaf, recipLeaf, factLeaf, modLeaf, F, addF, subF, mulF, divF, is24F,
  countRecip, countFact, countMod, factBig, isFactDegenerate, FACT_MAX_CARD,
  // 🔴 INPUT-08.1 §3.4/§4：幂/开方/对数求值一律复用引擎侧 BigInt 原语，
  //   禁在本层重写（禁 Math.pow/Math.log/Math.sqrt/toFixed）。
  ipow, rootExact, logExact, countPow, countLog,
} from './RecipSolver';

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
  // INPUT-07
  FACT_OPERAND_NOT_LEAF: 'fact_operand_not_leaf',
  FACT_DANGLING: 'fact_dangling',
  MOD_OPERAND_NOT_LEAF: 'mod_operand_not_leaf',
  MOD_DANGLING: 'mod_dangling',
  MOD_BY_ZERO: 'mod_by_zero',
  MOD_NOT_INTEGER: 'mod_not_integer',
  // ── INPUT-08.1 §4：幂 / 开方 / 对数专属错误码（🔴 禁再落通用 TRAILING_TOKEN）──
  POW_DANGLING: 'pow_dangling',
  POW_OPERAND_NOT_LEAF: 'pow_operand_not_leaf',
  POW_NOT_EXACT: 'pow_not_exact',
  POW_CHAINED: 'pow_chained',
  LOG_DANGLING: 'log_dangling',
  LOG_OPERAND_NOT_LEAF: 'log_operand_not_leaf',
  LOG_DOMAIN: 'log_domain',
  LOG_NOT_EXACT: 'log_not_exact',
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
  [ERR.POW_DANGLING]: '幂需要底数和指数（开方为连按两次 ^）',
  [ERR.POW_OPERAND_NOT_LEAF]: '幂只能作用于牌面数字',
  [ERR.POW_NOT_EXACT]: '开方结果必须是精确值',
  [ERR.POW_CHAINED]: '幂不能连续使用（如 2^3^4）',
  [ERR.LOG_DANGLING]: '对数需要底数和真数',
  [ERR.LOG_OPERAND_NOT_LEAF]: '对数只能作用于牌面数字',
  [ERR.LOG_DOMAIN]: '对数的底须大于 1、真数须大于 0',
  [ERR.LOG_NOT_EXACT]: '对数结果必须是整数',
  [ERR.FACT_OPERAND_NOT_LEAF]: '阶乘只能作用于牌面数字',
  [ERR.FACT_DANGLING]: '阶乘前面需要一个数字',
  [ERR.MOD_OPERAND_NOT_LEAF]: '取模两侧只能是牌面数字',
  [ERR.MOD_DANGLING]: '取模需要两个数字',
  [ERR.MOD_BY_ZERO]: '不能对 0 取模',
  [ERR.MOD_NOT_INTEGER]: '取模两侧必须是非负整数',
};

function fail(code, detail) {
  const e = new Error(code);
  e.__m24Parse = true;
  e.code = code;
  if (detail !== undefined) e.detail = detail;
  throw e;
}

// ============ 🔴 INPUT-07 §1.5.3：修饰不可叠加的单一判据 ============
// isRawLeaf(node) := node 是数字叶子，且未被任何高级符号（Recip/Fact/Mod）包裹
//
// 一条判据覆盖规范 §1.5.2 全部 9 行禁止矩阵，不写 9 个特判：
//   行1 1/(1/3)  行2 1/(3!)   行3 1/(7%3)
//   行4 (1/3)!    行5 (3!)!    行6 (7%3)!
//   行7 7%(1/3)   行8 7%(3!)   行9 (7%3)%2
// ⚠️ 矩阵为 9 行非 8 行：3 个符号全组合 3×3=9，任务书原列 8 个遗漏了
//    「倒数×倒数」（1/(1/3)）—— 规范 §1.5.2 已指出。本判据天然覆盖。
//
// ★ 冗余括号不改变叶子性质（§1.5.4）：parser 的 atom()/atomLeaf() 已在构造时
//   剥除括号（括号不产生 AST 节点），故此处无需再剥 ⇒ (4)!、((4))!、(7)%(3) 不误伤。
function isRawLeaf(node) {
  return !!node && node.op === 'num';
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

  // term := powish (('*'|'/') powish)*        ← ★ INPUT-08.1 §1.2
  term() {
    let node = this.powish();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = this.next().value;
        const rhs = this.powish();
        node = { op, a: node, b: rhs };
      } else break;
    }
    return node;
  }

  // ============ INPUT-08.1 §1.2 / §2.2 / §3.1 ============
  // powish := modish (('^' ['^']) modish)? | 'LOG' ...
  // 🔴 项目主 2026-08-11 裁定：幂/对数与 % **同级**、**不可链式**。
  //   写成 `?`（最多一次）而非 `*` ⇒ 2^3^4 在语法层即无法接受（同 modish 的 (7%3)%2）。
  // 🔴 §3.1 开方：'^' 连按两次 ⇒ b 作根指数（专用字段 rootIdx），**不建 1/b 子树**
  //   （建子树会让 R 位误标，INPUT-08 §1.2 已论证）。第三次 '^' ⇒ POW_DANGLING。
  powish() {
    const left = this.modish();
    const t = this.peek();
    if (t && (t.type === 'pow' || t.type === 'log')) {
      const isPow = t.type === 'pow';
      this.next();
      const DANGLING = isPow ? ERR.POW_DANGLING : ERR.LOG_DANGLING;
      const NOT_LEAF = isPow ? ERR.POW_OPERAND_NOT_LEAF : ERR.LOG_OPERAND_NOT_LEAF;
      // §3.1：第二个 '^' ⇒ 开方；第三个 '^' ⇒ POW_DANGLING（最多两次）
      let isRoot = false;
      if (isPow && this.peek() && this.peek().type === 'pow') {
        this.next();
        isRoot = true;
        if (this.peek() && this.peek().type === 'pow') fail(ERR.POW_DANGLING); // a^^^b
      }
      const nxt = this.peek();
      if (!nxt || nxt.type === 'operator' || nxt.type === 'right_paren') fail(DANGLING);
      const right = this.modish();
      // §1.3 / §2.2 通则：两侧均须为未经修饰的原始牌面叶子
      if (!isRawLeaf(left) || !isRawLeaf(right)) fail(NOT_LEAF);
      // 🔴 不可链式：右侧之后若又出现 '^'/'log'，报专属 POW_CHAINED 而非通用 trailing_token
      const after = this.peek();
      if (after && (after.type === 'pow' || after.type === 'log')) fail(ERR.POW_CHAINED);
      return isPow
        ? this.mkPow(left, right, isRoot)
        : this.mkLog(left, right);
    }
    return left;
  }

  // §3.1 + §3.4：开方走 rootIdx 专用字段；结果须精确，否则 POW_NOT_EXACT。
  mkPow(left, right, isRoot) {
    const a = left.card, b = right.card;
    if (!Number.isInteger(a) || !Number.isInteger(b)) fail(ERR.POW_OPERAND_NOT_LEAF);
    if (isRoot) {
      if (b < 2) fail(ERR.POW_DANGLING);            // a^(1/1) 退化、a^(1/0) 无意义
      const r = rootExact(a, b);                    // 引擎侧 BigInt 整数幂反查
      if (r === null) fail(ERR.POW_NOT_EXACT);      // 如 2^(1/2) 无理
      return { op: 'pow', a: left, b: right, rootIdx: b, v: r };
    }
    if (b < 0) fail(ERR.POW_DANGLING);
    return { op: 'pow', a: left, b: right, v: F(ipow(a, b)) };
  }

  // §2.2 + §4：对数定义域与精确性分别报 LOG_DOMAIN / LOG_NOT_EXACT
  mkLog(left, right) {
    const a = left.card, b = right.card;
    if (!Number.isInteger(a) || !Number.isInteger(b)) fail(ERR.LOG_OPERAND_NOT_LEAF);
    if (a <= 1 || b <= 0) fail(ERR.LOG_DOMAIN);     // 底 ≤1（含 0/1）、真数 ≤0
    const v = logExact(a, b);                       // 引擎侧 BigInt，禁 Math.log
    if (v === null) fail(ERR.LOG_NOT_EXACT);        // 如 log_2 3 无理
    if (v.d !== 1n) fail(ERR.LOG_NOT_EXACT);        // 非整数（如 log_4 8 = 3/2）
    return { op: 'log', a: left, b: right, v };
  }

  // ============ INPUT-07 §1.3：modish := unary ('%' unary)? ============
  // ★ 写成 `?`（最多一次）而非 `*`（可重复），使 (7%3)%2 在语法层即无法接受 ——
  //   第二个 % 会落到 trailing_token / 或因左侧不是原始叶子而被 isRawLeaf 拒收。
  // 🔴 两侧必须是未经任何高级符号修饰的原始牌面叶子（§1.3.1 + §1.5 通则）。
  modish() {
    const left = this.unary();
    const t = this.peek();
    if (t && t.type === 'mod') {
      this.next();
      const nxt = this.peek();
      if (!nxt || nxt.type === 'operator') fail(ERR.MOD_DANGLING);
      const right = this.unary();
      // 通则判据：两侧均需为未修饰的原始叶子
      //   ⇒ 拒收 (3+4)%3、7%(1+2)、(7%3)%2、(3!)%2、7%(3!)、(1/3)%2、7%(1/3)
      if (!isRawLeaf(left) || !isRawLeaf(right)) fail(ERR.MOD_OPERAND_NOT_LEAF);
      // §1.3.2 合法性：非负整数、b>0（含王牌 0 作模数 ⇒ 拒）
      if (!Number.isInteger(left.card) || left.card < 0) fail(ERR.MOD_NOT_INTEGER);
      if (!Number.isInteger(right.card) || right.card < 0) fail(ERR.MOD_NOT_INTEGER);
      if (right.card === 0) fail(ERR.MOD_BY_ZERO);
      return modLeaf(left.card, left.slot, right.card, right.slot);
    }
    return left;
  }

  // unary := 'RECIP' atomLeaf | postfix
  unary() {
    const t = this.peek();
    if (t && t.type === 'recip') {
      this.next();
      const nxt = this.peek();
      if (!nxt) fail(ERR.RECIP_DANGLING);
      if (nxt.type === 'operator') fail(ERR.RECIP_DANGLING);
      const leaf = this.atomLeaf(); // ★ 只接受叶子（含冗余括号）
      // 🔴 §1.5 矩阵行 1/2/3：倒数不得作用于倒数/阶乘/模的输出。
      //    atomLeaf 已保证返回 num 叶子，但显式再查一次以防后续改动遗漏（且覆盖 1/(3!) 路）。
      if (!isRawLeaf(leaf)) fail(ERR.RECIP_OPERAND_NOT_LEAF);
      return recipLeaf(leaf.card, leaf.slot);
    }
    return this.postfix();
  }

  // ============ INPUT-07 §1.2：postfix := atom '!'* ============
  // ★ 循环吃掉连续的 '!'，使 (3!)! 能被【语义】拒收而非【语法】报错 ——
  //   第二次循环时 base 已是 fact 节点，isRawLeaf 失败 ⇒ fact_operand_not_leaf（语义错误，提示更准）。
  //   若写成只吃一个，(3!)! 会报 trailing_token（「格式不正确」），对用户无指导意义。
  postfix() {
    let base = this.atom();
    while (this.peek() && this.peek().type === 'fact') {
      this.next();
      // 🔴 §1.2.1 + §1.5 矩阵行 4/5/6：! 子节点必为未修饰的数字叶子
      //    ⇒ 拒收 (2+2)!、(3×2)!、(4!)!、(1/3)!、(7%3)!
      if (!isRawLeaf(base)) fail(ERR.FACT_OPERAND_NOT_LEAF);
      base = factLeaf(base.card, base.slot);
    }
    return base;
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
    // INPUT-07：阶乘（限叶子，parser 已保证 arg 为 num）
    if (t.op === 'fact') {
      if (!t.arg || t.arg.op !== 'num') return null;
      if (!Number.isInteger(t.arg.card) || t.arg.card < 0) return null;
      return F(factBig(t.arg.card));
    }
    // INPUT-08.1 §1/§2/§3：幂 / 开方 / 对数。
    // 🔴 值在 parser 构造时已由引擎侧 BigInt 原语算出并存于 t.v（禁在此重算、禁浮点）；
    //   开方由 rootIdx 字段标识，不建 1/b 子树。
    if (t.op === 'pow' || t.op === 'log') {
      return t.v !== undefined && t.v !== null ? t.v : null;
    }
    // INPUT-07：模（限叶子，§1.3.2 非负整数 + b>0）
    if (t.op === 'mod') {
      const ma = rec(t.a);
      const mb = rec(t.b);
      if (ma === null || mb === null) return null;
      if (ma.d !== 1n || mb.d !== 1n) return null;
      if (ma.n < 0n) return null;
      if (mb.n <= 0n) { divZero = true; return null; }   // 对 0 取模 ⇒ 求值失败
      return F(ma.n % mb.n);
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
  // 高级计算关闭时不允许出现任何高级 token（开关关闭 = INPUT-05 计算行为）
  // INPUT-07 §1.1：单一开关控制全部高级符号（倒数、阶乘、模）
  // 🔴 INPUT-08.1 §5：补登记 'pow'/'log'（原缺失 ⇒ capPow 关时输入 8^3 误报
  //   「算式格式不正确」而非「请先开启高级计算」；task-129 实测坐实）。
  const ADV_TOKENS = ['recip', 'fact', 'mod', 'pow', 'log'];
  if (!advancedCalc && (tokens || []).some((t) => t && ADV_TOKENS.indexOf(t.type) >= 0)) {
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
    // INPUT-07：fact 占 1 牌、mod 占 2 牌
    if (t.op === 'fact') { slots.push(t.arg.slot); return; }
    if (t.op === 'mod') { slots.push(t.a.slot); slots.push(t.b.slot); return; }
    // INPUT-08.1：pow / log 各占 2 牌（同 mod）。开方的根指数牌亦计入（rootIdx 形态
    //   仍有 b 叶子），故此处无需特判 rootIdx。
    if (t.op === 'pow' || t.op === 'log') { slots.push(t.a.slot); slots.push(t.b.slot); return; }
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
  // INPUT-07：阶乘/模标记。退化式 1!/2! 不得触发"使用高级符号"判定（R-03），
  //   也不计牌面 ≥7 的 !（§1.2.2：UI 允许输入但不据此判定）。
  const countFactEff = (t) => {
    if (!t || t.op === 'num' || t.op === 'one' || t.op === 'zero' || t.op === 'recip') return 0;
    if (t.op === 'fact') {
      const c = t.arg && t.arg.card;
      return (isFactDegenerate(c) || c > FACT_MAX_CARD) ? 0 : 1;
    }
    if (t.op === 'mod') return 0;
    return countFactEff(t.a) + countFactEff(t.b);
  };
  const usedFact = countFactEff(pr.ast) > 0;
  const usedMod = countMod(pr.ast) > 0;
  // 🔴 INPUT-08.1 §9.8：P/L 位一律走 countPow/countLog 的**节点存在性**，
  //   禁从渲染文本反推（别名擦除：开方渲染为 √a，文本里没有 '^'）。
  const usedPow = countPow(pr.ast) > 0;
  const usedLog = countLog(pr.ast) > 0;
  const usedAdv = usedRecip || usedFact || usedMod || usedPow || usedLog;
  if (ev.is24) {
    return { pass: true, ast: pr.ast, value: ev.value, usedRecip, usedFact, usedMod, usedPow, usedLog, usedAdv };
  }
  const label = ev.value.d === 1n ? String(ev.value.n) : `${ev.value.n}/${ev.value.d}`;
  return { pass: false, reason: 'not_24', actualLabel: label, value: ev.value, usedRecip, usedFact, usedMod, usedPow, usedLog, usedAdv };
}

export default {
  parse, evalAst, checkUserAnswer, ERR, ERR_MSG,
};
